import { describe, expect, it } from 'vitest';

import { displayTitle } from '../../src/collection-loads/collection-loads.query.service.js';

/**
 * 002-load-management, FR-017 a FR-020: el título se muestra sin la puntuación
 * catalográfica final, pero el valor almacenado no cambia.
 */
describe('título mostrado', () => {
  it('retira los dos puntos finales y el espacio que los precede (FR-017)', () => {
    expect(displayTitle('Física universitaria :')).toBe('Física universitaria');
    expect(displayTitle('Administración:')).toBe('Administración');
  });

  it('retira la barra final y el espacio que la precede (FR-017)', () => {
    expect(displayTitle('Circuitos eléctricos /')).toBe('Circuitos eléctricos');
    expect(displayTitle('Volumen 1/')).toBe('Volumen 1');
  });

  it('recorta los espacios de relleno junto al signo', () => {
    expect(displayTitle('Matemática básica  :  ')).toBe('Matemática básica');
  });

  it('retira el igual final, que marca el título paralelo (FR-017)', () => {
    expect(displayTitle('Cálculo diferencial =')).toBe('Cálculo diferencial');
    expect(displayTitle('Redes de computadoras  =  ')).toBe('Redes de computadoras');
  });

  it('recorta una secuencia de signos finales (FR-017)', () => {
    // En la colección aparecen títulos con los dos signos encadenados.
    expect(displayTitle('Arquitectura de computadoras : /')).toBe(
      'Arquitectura de computadoras',
    );
    expect(displayTitle('Atrévete a no gustar / :')).toBe('Atrévete a no gustar');
    expect(displayTitle('Tutores y tutorías / :')).toBe('Tutores y tutorías');
  });

  it('conserva el punto interior de una secuencia final', () => {
    // El punto no se recorta, aunque le sigan signos que sí (FR-018).
    expect(displayTitle('Economia Intermedia. / :')).toBe('Economia Intermedia.');
  });

  it('deja intacto un título sin puntuación final', () => {
    expect(displayTitle('Introducción a la programación')).toBe(
      'Introducción a la programación',
    );
  });

  it('NO recorta el punto final, que también cierra abreviaturas (FR-018)', () => {
    expect(displayTitle('Ecuaciones diferenciales.')).toBe('Ecuaciones diferenciales.');
    expect(displayTitle('Introducción a la ing. mec.')).toBe(
      'Introducción a la ing. mec.',
    );
  });

  it('deja intacto un signo interior', () => {
    expect(displayTitle('Redes : teoría y práctica')).toBe('Redes : teoría y práctica');
    expect(displayTitle('Entrada/salida de datos')).toBe('Entrada/salida de datos');
    expect(displayTitle('a = b en álgebra')).toBe('a = b en álgebra');
  });

  it('trata como ausente el título que queda vacío (FR-020)', () => {
    expect(displayTitle(':')).toBeNull();
    expect(displayTitle('  /  ')).toBeNull();
    expect(displayTitle('   ')).toBeNull();
  });

  it('propaga la ausencia de título', () => {
    expect(displayTitle(null)).toBeNull();
  });
});
