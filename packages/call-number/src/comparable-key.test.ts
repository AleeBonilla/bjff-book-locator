import { describe, expect, it } from 'vitest';

import {
  byteSuccessor,
  comparableKeyRangeForDdc,
  compareUnsignedBytes,
  encodeComparableKey,
} from './comparable-key.js';
import { normalizeCallNumber } from './normalization.js';
import {
  CallNumberNormalizationError,
  compareNormalizedCallNumbers,
  requireNormalizedCallNumber,
} from './ordering.js';

function normalized(input: string) {
  return requireNormalizedCallNumber(normalizeCallNumber(input));
}

function key(input: string) {
  return encodeComparableKey(normalizeCallNumber(input));
}

describe('encodeComparableKey', () => {
  it('reproduce exactamente el ejemplo hexadecimal de ck1', () => {
    expect(Array.from(key('CR 658.001 H477a11'))).toEqual([
      0x01, 0x43, 0x52, 0x00,
      0x36, 0x35, 0x38, 0x00, 0x30, 0x30, 0x31, 0x00,
      0x01, 0x48, 0x00, 0x34, 0x37, 0x37, 0x00,
      0x01, 0x41, 0x31, 0x31, 0x00, 0x00,
      0x00,
    ]);
  });

  it('rechaza resultados ambiguos e inválidos', () => {
    expect(() => encodeComparableKey(normalizeCallNumber(''))).toThrow(
      CallNumberNormalizationError,
    );
    expect(() =>
      encodeComparableKey(
        normalizeCallNumber('658 H477a11 23', { metadata: { ddcEdition: '23' } }),
      ),
    ).toThrow(CallNumberNormalizationError);
  });

  it('es determinista y conserva las fronteras lógicas', () => {
    expect(key('863 B268-i-2')).toEqual(key('863 B268-i-2'));
    expect(key('863 B268-i-2')).not.toEqual(key('863 B268i2'));
  });

  it('excluye la edición DDC estructurada pero incluye un sufijo no identificado', () => {
    const withoutEdition = encodeComparableKey(normalizeCallNumber('658 H477a11'));
    const structuredEdition = encodeComparableKey(
      normalizeCallNumber('658 H477a11', { metadata: { ddcEdition: '23' } }),
    );
    const redundantEdition = encodeComparableKey(
      normalizeCallNumber('658 H477a11 23', {
        metadata: { ddcEdition: '23', textualEditionIsRedundant: true },
      }),
    );
    const unidentifiedSuffix = key('658 H477a11 23');

    expect(structuredEdition).toEqual(withoutEdition);
    expect(redundantEdition).toEqual(withoutEdition);
    expect(unidentifiedSuffix).not.toEqual(withoutEdition);
  });

  it('preserva el orden semántico para un corpus representativo', () => {
    const corpus = [
      '004.0151 S248',
      '004.1 S248',
      '620 A100',
      '620.1 A100',
      '620.106 A100',
      '658',
      '658.001',
      '658 H477',
      '658 H477a11',
      '658 H477a11 23',
      '863 A238',
      '863 B268-i-2',
      '863 B268i2',
      '863 E43c',
      '863 E434h',
      '863 S248',
      '863 S25',
      'A863 A100',
      'CR 863 A100',
    ].map(normalized);

    for (const left of corpus) {
      for (const right of corpus) {
        expect(compareUnsignedBytes(encodeComparableKey(left), encodeComparableKey(right))).toBe(
          compareNormalizedCallNumbers(left, right),
        );
      }
    }
  });

  it('cumple antisimetría y transitividad', () => {
    const ordered = [
      '620 A100',
      '620.1 A100',
      '620.106 A100',
      '658 A100',
      '658.001 A100',
      '863 S248',
      '863 S25',
    ].map(key);

    for (let first = 0; first < ordered.length; first += 1) {
      for (let second = first + 1; second < ordered.length; second += 1) {
        const left = ordered[first];
        const right = ordered[second];
        expect(left).toBeDefined();
        expect(right).toBeDefined();
        expect(compareUnsignedBytes(left!, right!)).toBe(-1);
        expect(compareUnsignedBytes(right!, left!)).toBe(1);
      }
    }

    for (let first = 0; first < ordered.length - 2; first += 1) {
      const a = ordered[first];
      const b = ordered[first + 1];
      const c = ordered[first + 2];
      expect(compareUnsignedBytes(a!, b!)).toBe(-1);
      expect(compareUnsignedBytes(b!, c!)).toBe(-1);
      expect(compareUnsignedBytes(a!, c!)).toBe(-1);
    }
  });
});

describe('utilidades de intervalos binarios', () => {
  it('calcula el sucesor eliminando bytes posteriores al incrementado', () => {
    expect(byteSuccessor(Uint8Array.from([0x12, 0xff]))).toEqual(
      Uint8Array.from([0x13]),
    );
    expect(byteSuccessor(Uint8Array.from([0xff, 0xff]))).toBeNull();
  });

  it('construye un intervalo DDC contiguo dentro de un prefijo fijo', () => {
    const ddc = normalized('658').ddc;
    const range = comparableKeyRangeForDdc(null, ddc);
    const exact = key('658 A100');
    const descendant = key('658.123 A100');
    const followingClass = key('659 A100');

    expect(compareUnsignedBytes(exact, range.lowerBound)).toBeGreaterThanOrEqual(0);
    expect(range.upperBound).not.toBeNull();
    expect(compareUnsignedBytes(descendant, range.upperBound!)).toBeLessThan(0);
    expect(compareUnsignedBytes(followingClass, range.upperBound!)).toBeGreaterThanOrEqual(0);
  });
});
