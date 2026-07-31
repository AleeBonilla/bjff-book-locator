import { describe, expect, it } from 'vitest';

import { parseClassification } from '../src/index.js';

/**
 * T036 — Descomposición del código en prefijo, número DDC, Cutter e indicador de
 * edición. Reglas en docs/clasificacion.md.
 */
describe('parseClassification', () => {
  it('separa número DDC, Cutter e indicador de edición', () => {
    const parsed = parseClassification('658 W721A6 23');
    expect(parsed.prefix).toBe('');
    expect(parsed.ddc).toBe('658');
    expect(parsed.cutter).toBe('W721A6');
    expect(parsed.editionIndicator).toBe('23');
  });

  it('separa el prefijo de país del número DDC', () => {
    const parsed = parseClassification('CR863 A111a 23');
    expect(parsed.prefix).toBe('CR');
    expect(parsed.ddc).toBe('863');
    expect(parsed.cutter).toBe('A111a');
  });

  it('reconoce un código sin indicador de edición', () => {
    const parsed = parseClassification('658 H477A11');
    expect(parsed.ddc).toBe('658');
    expect(parsed.cutter).toBe('H477A11');
    expect(parsed.editionIndicator).toBe('');
  });

  it('une los bloques de dígitos del agrupamiento Dewey en un solo número', () => {
    const parsed = parseClassification('303.440 972 862 021 G216c 23');
    expect(parsed.ddc).toBe('303.440972862021');
    expect(parsed.cutter).toBe('G216c');
    expect(parsed.editionIndicator).toBe('23');
  });

  it('une un bloque corto de agrupamiento', () => {
    const parsed = parseClassification('378.728 6 D444d 23');
    expect(parsed.ddc).toBe('378.7286');
    expect(parsed.cutter).toBe('D444d');
  });

  it('une un espacio pegado al punto decimal', () => {
    const parsed = parseClassification('658. 8 T111t 23');
    expect(parsed.ddc).toBe('658.8');
    expect(parsed.cutter).toBe('T111t');
  });

  it('recoge los segmentos sobrantes que no puede interpretar', () => {
    const parsed = parseClassification('658 W721 A6 XYZ');
    expect(parsed.ddc).toBe('658');
    expect(parsed.cutter).toBe('W721');
    expect(parsed.extraSegments).toEqual(['A6', 'XYZ']);
  });

  it('reúne el Cutter partido por un espacio junto a un guion', () => {
    const parsed = parseClassification('702 W- 444w 23');
    expect(parsed.ddc).toBe('702');
    expect(parsed.cutter).toBe('W-444w');
    expect(parsed.extraSegments).toEqual([]);
    expect(parsed.editionIndicator).toBe('23');
  });

  it('identifica el Cutter por su forma, no por su posición', () => {
    const parsed = parseClassification('371.4 M M423t');
    expect(parsed.cutter).toBe('M423t');
    expect(parsed.extraSegments).toEqual(['M']);
  });

  it('absorbe el Cutter repetido de forma literal', () => {
    const parsed = parseClassification('703 B888b B888b 23');
    expect(parsed.cutter).toBe('B888b');
    expect(parsed.extraSegments).toEqual([]);
  });

  it('une la marca de obra separada cuando es lo único que resta', () => {
    const parsed = parseClassification('669 C146 p 23');
    expect(parsed.cutter).toBe('C146p');
    expect(parsed.extraSegments).toEqual([]);
  });

  it('marca como vacío un código ausente', () => {
    expect(parseClassification('').isEmpty).toBe(true);
    expect(parseClassification('   ').isEmpty).toBe(true);
  });

  it('marca como vacío un código compuesto solo por separadores', () => {
    expect(parseClassification(' . - , ').isEmpty).toBe(true);
  });

  it('recorta los espacios de relleno del valor recibido', () => {
    const parsed = parseClassification('   863 S248m 23   ');
    expect(parsed.ddc).toBe('863');
    expect(parsed.cutter).toBe('S248m');
  });
});
