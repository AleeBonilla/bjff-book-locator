import { compareCanonicalText } from './characters.js';
import {
  type AdditionalComponent,
  type NormalizationResult,
  type NormalizedCallNumber,
} from './types.js';

function compareOptional<T>(
  left: T | null,
  right: T | null,
  comparePresent: (leftValue: T, rightValue: T) => -1 | 0 | 1,
): -1 | 0 | 1 {
  if (left === null) {
    return right === null ? 0 : -1;
  }
  if (right === null) {
    return 1;
  }
  return comparePresent(left, right);
}

function compareTextList(left: string[], right: string[]): -1 | 0 | 1 {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];
    if (leftItem === undefined || rightItem === undefined) {
      throw new Error('Lista normalizada incoherente.');
    }
    const comparison = compareCanonicalText(leftItem, rightItem);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
}

function canonicalAdditional(component: AdditionalComponent): string {
  return `U${component.value}`;
}

export function compareNormalizedCallNumbers(
  left: NormalizedCallNumber,
  right: NormalizedCallNumber,
): -1 | 0 | 1 {
  if (
    left.schema_version !== right.schema_version ||
    left.normalization_profile !== right.normalization_profile
  ) {
    throw new IncompatibleCallNumberProfilesError(left, right);
  }

  let comparison = compareOptional(left.prefix, right.prefix, compareCanonicalText);
  if (comparison !== 0) {
    return comparison;
  }

  comparison = compareCanonicalText(left.ddc.class_digits, right.ddc.class_digits);
  if (comparison !== 0) {
    return comparison;
  }

  comparison = compareCanonicalText(
    left.ddc.fractional_digits,
    right.ddc.fractional_digits,
  );
  if (comparison !== 0) {
    return comparison;
  }

  comparison = compareOptional(left.cutter, right.cutter, (leftCutter, rightCutter) => {
    const letters = compareCanonicalText(leftCutter.letters, rightCutter.letters);
    return letters === 0
      ? compareCanonicalText(leftCutter.digits, rightCutter.digits)
      : letters;
  });
  if (comparison !== 0) {
    return comparison;
  }

  comparison = compareOptional(left.workmark, right.workmark, (leftWorkmark, rightWorkmark) =>
    compareTextList(leftWorkmark.segments, rightWorkmark.segments),
  );
  if (comparison !== 0) {
    return comparison;
  }

  return compareTextList(
    left.additional_components.map(canonicalAdditional),
    right.additional_components.map(canonicalAdditional),
  );
}

export class IncompatibleCallNumberProfilesError extends Error {
  constructor(left: NormalizedCallNumber, right: NormalizedCallNumber) {
    super(
      `No se pueden comparar perfiles incompatibles: ${left.normalization_profile} y ${right.normalization_profile}.`,
    );
    this.name = 'IncompatibleCallNumberProfilesError';
  }
}

export class CallNumberNormalizationError extends Error {
  readonly result: NormalizationResult;

  constructor(result: NormalizationResult) {
    super(`No se puede comparar ni codificar una signatura con estado ${result.status}.`);
    this.name = 'CallNumberNormalizationError';
    this.result = result;
  }
}

export function requireNormalizedCallNumber(
  result: NormalizationResult,
): NormalizedCallNumber {
  if (result.status !== 'ok') {
    throw new CallNumberNormalizationError(result);
  }
  return result;
}
