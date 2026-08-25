import { describe, expect, it } from 'vitest';

import { normalizeCallNumber } from './normalization.js';
import {
  IncompatibleCallNumberProfilesError,
  compareNormalizedCallNumbers,
  requireNormalizedCallNumber,
} from './ordering.js';

function normalized(input: string) {
  return requireNormalizedCallNumber(normalizeCallNumber(input));
}

function compare(left: string, right: string) {
  return compareNormalizedCallNumbers(normalized(left), normalized(right));
}

describe('compareNormalizedCallNumbers', () => {
  it.each([
    ['004.0151 S248', '004.1 S248'],
    ['620 A100', '620.1 A100'],
    ['620.1 A100', '620.106 A100'],
    ['658 A100', '658.001 A100'],
    ['863 A238', '863 B415'],
    ['863 S248', '863 S25'],
    ['863 E43c', '863 E434h'],
    ['863 K19m', '863 K199p'],
    ['863 H477a11', '863 H477a12'],
    ['999 A100', 'A863 A100'],
    ['A863 A100', 'C863 A100'],
    ['C863 A100', 'Ch863 A100'],
    ['Ch863 A100', 'CR863 A100'],
  ])('reproduce el caso normativo %s < %s', (left, right) => {
    expect(compare(left, right)).toBe(-1);
    expect(compare(right, left)).toBe(1);
  });

  it('considera equivalentes las variantes de caja', () => {
    expect(compare('cr863 b268-i-2', 'CR 863 B268-I-2')).toBe(0);
  });

  it('ordena ausencia antes que presencia en cada componente opcional', () => {
    expect(compare('658', '658 H477')).toBe(-1);
    expect(compare('658 H477', '658 H477a')).toBe(-1);
    expect(compare('658 H477a', '658 H477a 2')).toBe(-1);
  });

  it('ordena una frontera de segmento antes que la continuación alfanumérica', () => {
    expect(compare('863 B268-i-2', '863 B268i2')).toBe(-1);
  });

  it('rechaza la comparación entre perfiles incompatibles', () => {
    const base = normalized('863 B268');
    const imported = requireNormalizedCallNumber(
      normalizeCallNumber('863 B268', {
        profile: {
          id: 'base-1-import',
          maxInputLength: 512,
          noncanonicalDdcTrailingZero: 'preserve',
        },
      }),
    );

    expect(() => compareNormalizedCallNumbers(base, imported)).toThrow(
      IncompatibleCallNumberProfilesError,
    );
  });
});
