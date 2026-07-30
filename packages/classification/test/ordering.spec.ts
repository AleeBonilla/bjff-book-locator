import { describe, expect, it } from 'vitest';

import { comparableKey } from '../src/index.js';

/**
 * T038 — Orden (FR-019, FR-020) con los pares documentados en docs/clasificacion.md.
 *
 * La comparación se hace con `<` sobre las cadenas, que en JavaScript es binaria por
 * punto de código: el mismo criterio que `COLLATE "C"` en PostgreSQL.
 */
function key(code: string): string {
  const value = comparableKey(code);
  if (value === null) throw new Error(`clave nula para ${code}`);
  return value;
}

function precede(a: string, b: string): boolean {
  return key(a) < key(b);
}

describe('orden de las claves comparables', () => {
  it('ordena el número DDC como fracción decimal', () => {
    expect(precede('004.0151 A111a', '004.1 B222b')).toBe(true);
  });

  it('ordena un número más específico después del general', () => {
    expect(precede('658 D124a', '658.001 D124a')).toBe(true);
  });

  it('ordena las cifras Cutter como fracción decimal', () => {
    expect(precede('863 S248m', '863 S25m')).toBe(true);
  });

  it('ordena las letras iniciales del Cutter alfabéticamente', () => {
    expect(precede('863 A238m', '863 B415m')).toBe(true);
  });

  it('ordena la marca de obra de izquierda a derecha', () => {
    expect(precede('658 H477a11', '658 H477a12')).toBe(true);
  });

  it('coloca los códigos sin prefijo antes que cualquiera con prefijo', () => {
    expect(precede('999 Z999z', 'A863 A111a')).toBe(true);
    expect(precede('8693.7 M378a', 'A863 A111a')).toBe(true);
  });

  it('agrupa los prefijos alfabéticamente', () => {
    expect(precede('A863 A111a', 'C863 A111a')).toBe(true);
    expect(precede('C863 A111a', 'Ch863 A111a')).toBe(true);
    expect(precede('Ch863 A111a', 'CR863 A111a')).toBe(true);
  });

  it('trata Cu y CU como el mismo prefijo', () => {
    expect(key('Cu863 X555x')).toBe(key('CU863 X555x'));
  });

  it('ordena el número DDC por valor y no por longitud del texto', () => {
    expect(precede('863 A111a', '8693.7 M378a')).toBe(true);
    expect(precede('999 A111a', '1000.5 A111a')).toBe(true);
  });

  it('ordena una secuencia completa de forma estable', () => {
    const codes = [
      'CR863 A111a 23',
      '004.1 B222b 23',
      'A863 A111a 23',
      '004.0151 A111a 23',
      '863 S25m 23',
      '863 S248m 23',
    ];
    const ordered = [...codes].sort((a, b) => (key(a) < key(b) ? -1 : 1));
    expect(ordered).toEqual([
      '004.0151 A111a 23',
      '004.1 B222b 23',
      '863 S248m 23',
      '863 S25m 23',
      'A863 A111a 23',
      'CR863 A111a 23',
    ]);
  });
});
