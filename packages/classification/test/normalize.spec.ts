import { describe, expect, it } from 'vitest';

import { comparableKey } from '../src/index.js';

/**
 * T037 — Normalización (FR-017): coma decimal a punto, espacios internos, guiones del
 * Cutter, mayúsculas y retiro del indicador de edición solo cuando existe Cutter.
 */
describe('normalización de la clave comparable', () => {
  it('convierte la coma decimal en punto', () => {
    expect(comparableKey('352,85 C333c 23')).toBe(comparableKey('352.85 C333c 23'));
  });

  it('retira los espacios internos del número DDC', () => {
    expect(comparableKey('378.728 6 D444d')).toBe(comparableKey('378.7286 D444d'));
  });

  it('retira el espacio pegado al punto decimal', () => {
    expect(comparableKey('658. 8 T111t')).toBe(comparableKey('658.8 T111t'));
  });

  it('conserva solo el primer punto del número DDC', () => {
    expect(comparableKey('658.401.2 E555e')).toBe(comparableKey('658.4012 E555e'));
  });

  it('une los bloques del agrupamiento Dewey', () => {
    expect(comparableKey('303.440 972 862 021 G216c')).toBe(
      comparableKey('303.440972862021 G216c'),
    );
  });

  it('ignora los guiones dentro del segmento Cutter', () => {
    expect(comparableKey('333.79 O-686-i')).toBe(comparableKey('333.79 O686i'));
  });

  it('ignora la diferencia entre mayúsculas y minúsculas', () => {
    expect(comparableKey('530 S492Fs7')).toBe(comparableKey('530 S492fs7'));
  });

  it('ignora un espacio junto a un guion del Cutter', () => {
    expect(comparableKey('702 W- 444w')).toBe(comparableKey('702 W-444w'));
  });

  it('retira el indicador de edición cuando existe Cutter', () => {
    expect(comparableKey('658 H477A11 23')).toBe(comparableKey('658 H477A11'));
  });

  it('produce una clave solo con caracteres seguros para la colación binaria', () => {
    const key = comparableKey('CR863 S-248m2 23');
    expect(key).toMatch(/^[A-Z0-9. ]+$/);
  });

  it('devuelve null cuando no hay código', () => {
    expect(comparableKey('')).toBeNull();
    expect(comparableKey('   ')).toBeNull();
    expect(comparableKey(null)).toBeNull();
  });
});
