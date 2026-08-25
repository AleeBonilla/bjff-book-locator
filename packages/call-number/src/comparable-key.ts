import {
  BASE_NORMALIZATION_PROFILE_ID,
  COMPARABLE_KEY_VERSION,
  type AdditionalComponent,
  type DdcComponent,
  type NormalizationResult,
} from './types.js';
import { CallNumberNormalizationError } from './ordering.js';

const ABSENT = 0x00;
const PRESENT = 0x01;

function ascii(value: string): number[] {
  const bytes: number[] = [];
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code > 0x7f || !/[A-Z0-9]/.test(character)) {
      throw new TypeError(`Valor no canónico para ck${COMPARABLE_KEY_VERSION}: ${value}`);
    }
    bytes.push(code);
  }
  return bytes;
}

function text(value: string): number[] {
  return [...ascii(value), ABSENT];
}

function optionalText(value: string | null): number[] {
  return value === null ? [ABSENT] : [PRESENT, ...text(value)];
}

function segmentList(segments: string[] | null): number[] {
  if (segments === null || segments.length === 0) {
    return [ABSENT];
  }
  return [PRESENT, ...segments.flatMap(text), ABSENT];
}

function canonicalAdditional(component: AdditionalComponent): string {
  return `U${component.value}`;
}

function validateDdc(ddc: DdcComponent): void {
  if (!/^\d{3}$/.test(ddc.class_digits) || !/^\d*$/.test(ddc.fractional_digits)) {
    throw new TypeError('El componente DDC no satisface los invariantes de NORM-012.');
  }

  const expectedCanonical =
    ddc.fractional_digits.length === 0
      ? ddc.class_digits
      : `${ddc.class_digits}.${ddc.fractional_digits}`;
  if (ddc.canonical !== expectedCanonical) {
    throw new TypeError('ddc.canonical no coincide con sus dígitos normalizados.');
  }
}

export function encodeComparableKey(callNumber: NormalizationResult): Uint8Array {
  if (callNumber.status !== 'ok') {
    throw new CallNumberNormalizationError(callNumber);
  }
  if (callNumber.normalization_profile !== BASE_NORMALIZATION_PROFILE_ID) {
    throw new TypeError(
      `ck${COMPARABLE_KEY_VERSION} requiere el perfil ${BASE_NORMALIZATION_PROFILE_ID}.`,
    );
  }
  validateDdc(callNumber.ddc);

  const bytes = [
    ...optionalText(callNumber.prefix),
    ...ascii(callNumber.ddc.class_digits),
    ABSENT,
    ...ascii(callNumber.ddc.fractional_digits),
    ABSENT,
    ...(callNumber.cutter === null
      ? [ABSENT]
      : [
          PRESENT,
          ...text(callNumber.cutter.letters),
          ...text(callNumber.cutter.digits),
        ]),
    ...segmentList(callNumber.workmark?.segments ?? null),
    ...segmentList(callNumber.additional_components.map(canonicalAdditional)),
  ];

  return Uint8Array.from(bytes);
}

export function compareUnsignedBytes(
  left: Uint8Array,
  right: Uint8Array,
): -1 | 0 | 1 {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftByte = left[index];
    const rightByte = right[index];
    if (leftByte === undefined || rightByte === undefined) {
      throw new Error('Secuencia binaria incoherente.');
    }
    if (leftByte < rightByte) {
      return -1;
    }
    if (leftByte > rightByte) {
      return 1;
    }
  }

  return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
}

export function byteSuccessor(value: Uint8Array): Uint8Array | null {
  const successor = value.slice();
  for (let index = successor.length - 1; index >= 0; index -= 1) {
    const byte = successor[index];
    if (byte !== undefined && byte < 0xff) {
      return Uint8Array.from([...successor.slice(0, index), byte + 1]);
    }
  }
  return null;
}

export interface ComparableKeyRange {
  lowerBound: Uint8Array;
  upperBound: Uint8Array | null;
}

export function encodeDdcLogicalPrefix(
  prefix: string | null,
  ddc: DdcComponent,
): Uint8Array {
  validateDdc(ddc);
  return Uint8Array.from([
    ...optionalText(prefix),
    ...ascii(ddc.class_digits),
    ABSENT,
    ...ascii(ddc.fractional_digits),
  ]);
}

export function comparableKeyRangeForDdc(
  prefix: string | null,
  ddc: DdcComponent,
): ComparableKeyRange {
  const lowerBound = encodeDdcLogicalPrefix(prefix, ddc);
  return { lowerBound, upperBound: byteSuccessor(lowerBound) };
}
