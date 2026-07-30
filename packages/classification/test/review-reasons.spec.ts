import { describe, expect, it } from 'vitest';

import { comparableKey, deriveClassification } from '../src/index.js';

/**
 * T040 — Motivos de revisión: FR-017a, FR-018, FR-018a, FR-018b, FR-025 a FR-025c.
 *
 * Criterio: se marca lo que admite más de una lectura, no todo lo que se aparta de la
 * forma canónica.
 */
function reasons(code: string): string[] {
  return deriveClassification(code).reviewReasons;
}

describe('valores con una sola lectura: no se marcan', () => {
  it('acepta la coma decimal', () => {
    expect(reasons('352,85 C333c 23')).toEqual([]);
    expect(comparableKey('352,85 C333c')).toBe(comparableKey('352.85 C333c'));
  });

  it('acepta el agrupamiento de dígitos con espacios', () => {
    expect(reasons('303.440 972 862 021 G216c 23')).toEqual([]);
    expect(reasons('378.728 6 D444d 23')).toEqual([]);
  });

  it('acepta el agrupamiento de dígitos con puntos', () => {
    expect(reasons('303.440.972.862.021 G216c 23')).toEqual([]);
    expect(reasons('658.401.2 E555e 23')).toEqual([]);
    expect(reasons('613.208.32 A779nu')).toEqual([]);
  });

  it('trata espacios y puntos como el mismo agrupamiento', () => {
    // Hallazgo del catálogo real: el mismo código aparece escrito de las dos formas.
    expect(comparableKey('303.440 972 862 021 G216c')).toBe(
      comparableKey('303.440.972.862.021 G216c'),
    );
  });

  it('acepta el espacio pegado al punto decimal', () => {
    expect(reasons('658. 8 T111t 23')).toEqual([]);
    expect(comparableKey('658. 8 T111t')).toBe(comparableKey('658.8 T111t'));
  });

  it('acepta el espacio junto a un guion del Cutter', () => {
    expect(reasons('702 W- 444w 23')).toEqual([]);
    expect(reasons('351.97286 C8374- lge 23')).toEqual([]);
    expect(reasons('972.86 I584 -i 23')).toEqual([]);
  });

  it('acepta la marca de obra separada por un espacio', () => {
    expect(reasons('669 C146 p 23')).toEqual([]);
    // La marca no se pierde: forma parte de la clave.
    expect(comparableKey('669 C146 p 23')).toBe(comparableKey('669 C146p 23'));
  });

  it('acepta el Cutter repetido de forma literal', () => {
    expect(reasons('703 B888b B888b 23')).toEqual([]);
    expect(comparableKey('703 B888b B888b')).toBe(comparableKey('703 B888b'));
  });

  it('no marca los prefijos documentados', () => {
    for (const code of [
      'CR863 A111a 23',
      'M863 A111a 23',
      'Pe863 B222b 23',
      'Ch863 C333c 23',
      'V863 D444d 23',
      'Cu863 X555x 23',
      'CU863 Y666y 23',
    ]) {
      expect(reasons(code)).toEqual([]);
    }
  });

  it('no marca un código canónico', () => {
    for (const code of [
      '001.4 B268-i-2 23',
      '004.0151 A111a 23',
      '500 P111p 23',
      '658 W721A6 23',
      '658 H477A11',
      '658.001 D124a 23',
      '863 S-925t3 23',
    ]) {
      expect(reasons(code)).toEqual([]);
    }
  });
});

describe('valores con más de una lectura: se marcan', () => {
  it('marca más de tres dígitos antes del punto', () => {
    expect(reasons('8693.7 M378a 23')).toContain('FOUR_DIGIT_CLASS');
  });

  it('marca un bloque no numérico tras el primer punto', () => {
    expect(reasons('658.4a.2 E555e 23')).toContain('NON_NUMERIC_GROUP');
  });

  it('marca un token previo al Cutter', () => {
    expect(reasons('371.4 M M423t')).toContain('AMBIGUOUS_SEGMENT');
  });

  it('marca más de un segmento sobrante tras el Cutter', () => {
    expect(reasons('658 W721 A6 XYZ')).toContain('AMBIGUOUS_SEGMENT');
  });

  it('marca un prefijo alfabético no documentado', () => {
    expect(reasons('Zz863 A777a 23')).toContain('UNDOCUMENTED_PREFIX');
  });

  it('importa la fila igualmente y con la mejor clave derivable', () => {
    const result = deriveClassification('371.4 M M423t');
    expect(result.reviewReasons.length).toBeGreaterThan(0);
    // El Cutter se identifica por su forma, no por su posición: la clave sale de
    // `M423t`, no del token suelto `M`.
    expect(result.comparableKey).toBe(comparableKey('371.4 M423t'));
  });

  it('acumula varios motivos en un mismo código', () => {
    const result = deriveClassification('8693.208.3 M378a XYZ');
    expect(result.reviewReasons).toContain('FOUR_DIGIT_CLASS');
    expect(result.reviewReasons).toContain('AMBIGUOUS_SEGMENT');
  });
});
