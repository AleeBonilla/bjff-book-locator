import { describe, expect, it } from 'vitest';

import { normalizeCallNumber } from './normalization.js';
import { requireNormalizedCallNumber } from './ordering.js';

describe('normalizeCallNumber', () => {
  it('normaliza una signatura sin prefijo', () => {
    const result = normalizeCallNumber('658 H477a11');

    expect(result).toMatchObject({
      schema_version: 1,
      normalization_profile: 'base-1',
      status: 'ok',
      prefix: null,
      ddc: {
        class_digits: '658',
        fractional_digits: '',
        canonical: '658',
      },
      cutter: { letters: 'H', digits: '477' },
      workmark: { segments: ['A11'] },
      ddc_edition: null,
      additional_components: [],
      issues: [],
    });
  });

  it('acepta prefijos separados o adyacentes y pliega espacios, caja y diacríticos', () => {
    const separated = normalizeCallNumber('  cr\t863   b268-i\u0301-2  ');
    const adjacent = normalizeCallNumber('CR863 B268-I-2');

    expect(separated).toEqual(adjacent);
    expect(separated).toMatchObject({
      status: 'ok',
      prefix: 'CR',
      cutter: { letters: 'B', digits: '268' },
      workmark: { segments: ['I', '2'] },
    });
  });

  it('conserva como estructuras distintas las fronteras creadas por guiones', () => {
    const segmented = requireNormalizedCallNumber(normalizeCallNumber('863 B268-i-2'));
    const joined = requireNormalizedCallNumber(normalizeCallNumber('863 B268i2'));

    expect(segmented.workmark?.segments).toEqual(['I', '2']);
    expect(joined.workmark?.segments).toEqual(['I2']);
  });

  it('conserva un número final sin inferir una edición DDC', () => {
    const result = normalizeCallNumber('658 H477a11 23');

    expect(result).toMatchObject({
      status: 'ok',
      ddc_edition: null,
      additional_components: [{ kind: 'unclassified', value: '23' }],
    });
    expect(result.issues.map(({ code }) => code)).toEqual([
      'DETACHED_SUFFIX',
      'UNIDENTIFIED_TRAILING_NUMBER',
    ]);
  });

  it('registra una edición estructurada sin incluirla como componente adicional', () => {
    const result = normalizeCallNumber('658 H477a11', {
      metadata: { ddcEdition: '23' },
    });

    expect(result).toMatchObject({
      status: 'ok',
      ddc_edition: '23',
      additional_components: [],
    });
    expect(result.issues).toEqual([]);
  });

  it('descarta una proyección textual de edición solo con garantía explícita', () => {
    const result = normalizeCallNumber('658 H477a11 23', {
      metadata: { ddcEdition: '23', textualEditionIsRedundant: true },
    });

    expect(result).toMatchObject({
      status: 'ok',
      ddc_edition: '23',
      additional_components: [],
    });
  });

  it('marca como ambigua una posible proyección textual sin garantía de origen', () => {
    const result = normalizeCallNumber('658 H477a11 23', {
      metadata: { ddcEdition: '23' },
    });

    expect(result.status).toBe('ambiguous');
    expect(result.issues.map(({ code }) => code)).toContain('UNVERIFIED_EDITION_PROJECTION');
  });

  it('es determinista e idempotente para cada forma válida', () => {
    const inputs = ['658 H477a11', 'CR 863 B268-i-2', '004.0151 S248'];

    for (const input of inputs) {
      expect(normalizeCallNumber(input)).toEqual(normalizeCallNumber(input));
    }
  });

  it.each([
    ['', 'EMPTY_INPUT', 'invalid'],
    ['ABC', 'MISSING_DDC', 'invalid'],
    ['863.', 'INVALID_DDC_SYNTAX', 'invalid'],
    ['863.10 H477', 'NONCANONICAL_DDC_TRAILING_ZERO', 'invalid'],
    ['658 H', 'INVALID_CUTTER', 'invalid'],
    ['658 H477--I', 'EMPTY_WORKMARK_SEGMENT', 'invalid'],
    ['658 H477a11 2A', 'DETACHED_SUFFIX', 'ok'],
    ['658 H477a11 23', 'UNIDENTIFIED_TRAILING_NUMBER', 'ok'],
    ['658 H477@', 'UNSUPPORTED_CHARACTER', 'invalid'],
  ] as const)(
    'emite %s -> %s',
    (input, expectedIssue, expectedStatus) => {
      const result = normalizeCallNumber(input);
      expect(result.status).toBe(expectedStatus);
      expect(result.issues.map(({ code }) => code)).toContain(expectedIssue);
    },
  );

  it('emite CONFLICTING_SOURCE_METADATA cuando texto y metadatos no concuerdan', () => {
    const result = normalizeCallNumber('658 H477a11 22', {
      metadata: { ddcEdition: '23', textualEditionIsRedundant: true },
    });

    expect(result.status).toBe('ambiguous');
    expect(result.issues.map(({ code }) => code)).toContain('CONFLICTING_SOURCE_METADATA');
  });

  it('permite a un perfil de importación conservar un cero DDC final con advertencia', () => {
    const result = normalizeCallNumber('863.10 H477', {
      profile: {
        id: 'base-1-import',
        maxInputLength: 512,
        noncanonicalDdcTrailingZero: 'preserve',
      },
    });

    expect(result.status).toBe('ok');
    expect(result.ddc?.canonical).toBe('863.10');
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'NONCANONICAL_DDC_TRAILING_ZERO',
        severity: 'warning',
      }),
    );
  });

  it('impone el límite de tamaño configurado', () => {
    const result = normalizeCallNumber('658 H477a11', {
      profile: {
        id: 'limited-test',
        maxInputLength: 5,
        noncanonicalDdcTrailingZero: 'reject',
      },
    });

    expect(result.status).toBe('invalid');
    expect(result.issues.map(({ code }) => code)).toContain('INPUT_TOO_LONG');
  });
});
