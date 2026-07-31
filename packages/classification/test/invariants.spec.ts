import { describe, expect, it } from 'vitest';

import { KEY_UPPER_SENTINEL, comparableKey, deriveClassification } from '../src/index.js';

/**
 * T039 — Equivalencias y límites: FR-021, FR-022, FR-023, FR-024.
 */
describe('invariantes de la clave comparable', () => {
  it('produce la misma clave con y sin indicador de edición (FR-021)', () => {
    expect(comparableKey('658 H477A11')).toBe(comparableKey('658 H477A11 23'));
    expect(comparableKey('CR863 A111a')).toBe(comparableKey('CR863 A111a 23'));
  });

  it('produce siempre una clave menor que el sentinel (FR-022)', () => {
    const codes = [
      '001.4 B268-i-2 23',
      'CR863 Z999z 23',
      '8693.7 M378a 23',
      '658 W721 A6 XYZ',
      'Zz863 A777a 23',
      '352,85 C333c 23',
    ];
    for (const code of codes) {
      const key = comparableKey(code);
      expect(key).not.toBeNull();
      expect(key! < KEY_UPPER_SENTINEL).toBe(true);
    }
  });

  it('es determinista entre invocaciones (FR-023)', () => {
    const code = '303.440 972 862 021 G216c 23';
    const first = comparableKey(code);
    const runs = Array.from({ length: 50 }, () => comparableKey(code));
    expect(new Set(runs).size).toBe(1);
    expect(runs[0]).toBe(first);
  });

  it('no depende de la configuración regional del entorno', () => {
    // La comparación debe ser binaria, no lingüística. En una colación de español,
    // 'CH' podría tratarse como una sola letra; aquí no.
    const a = comparableKey('C863 A111a')!;
    const b = comparableKey('Ch863 A111a')!;
    expect(a < b).toBe(true);
  });

  it('devuelve clave nula sin rechazar cuando no hay código (FR-024)', () => {
    const result = deriveClassification('');
    expect(result.comparableKey).toBeNull();
    expect(result.isEmpty).toBe(true);
    expect(result.reviewReasons).toEqual([]);
  });

  it('devuelve clave nula cuando el código son solo separadores (FR-024)', () => {
    const result = deriveClassification('  -.,  ');
    expect(result.comparableKey).toBeNull();
    expect(result.isEmpty).toBe(true);
  });

  it('conserva intacto el valor original recibido (FR-016)', () => {
    const original = '  352,85 C333c 23  ';
    const result = deriveClassification(original);
    expect(result.raw).toBe(original);
  });
});
