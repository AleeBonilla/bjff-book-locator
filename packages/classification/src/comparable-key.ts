import type { ParsedCode } from './parse.js';

/**
 * Construcción de la clave comparable.
 *
 * La clave debe ordenar correctamente bajo comparación binaria: `COLLATE "C"` en
 * PostgreSQL y `<` sobre cadenas en JavaScript son el mismo criterio (FR-023).
 *
 * Solo contiene `[A-Z0-9. ]`, cuyo punto de código máximo es `Z` (0x5A), por debajo
 * del sentinel `~` (0x7E) que exige FR-022.
 */

/** Límite superior reservado del dominio de claves. */
export const KEY_UPPER_SENTINEL = '~';

/** `comparable_key` es `VARCHAR(60)` en `database/01_schema.sql`. */
export const KEY_MAX_LENGTH = 60;

/**
 * Ancho fijo de la parte entera del número DDC.
 *
 * La DDC canónica usa tres dígitos, pero la colección contiene valores con cuatro.
 * Rellenar a un ancho fijo hace que la comparación binaria coincida con la numérica:
 * sin relleno, `1000` precedería a `999`.
 */
const DDC_INTEGER_WIDTH = 4;

const SEPARATOR = ' ';

export interface NormalizedDdc {
  value: string;
  /** Más de tres dígitos antes del punto: valor mal formado (FR-018a). */
  hasOversizedClass: boolean;
  /** Un bloque posterior al primer punto no es numérico: no es agrupamiento (FR-018b). */
  hasNonNumericGroup: boolean;
}

/**
 * Normaliza el número DDC.
 *
 * La coma decimal, el agrupamiento de dígitos —con espacios o con puntos— y el espacio
 * pegado al punto tienen una sola lectura, así que se resuelven en silencio (FR-018).
 * En el catálogo aparece el mismo código escrito de las dos formas:
 * `303.440 972 862 021` y `303.440.972.862.021`.
 */
export function normalizeDdc(ddc: string): NormalizedDdc {
  const withDots = ddc.replace(/,/g, '.');
  const parts = withDots.split('.');

  const head = parts[0] ?? '';
  const groups = parts.slice(1);

  // Un bloque con algo que no sean dígitos no puede leerse como agrupamiento.
  const hasNonNumericGroup = groups.some((group) => !/^\d*$/.test(group.trim()));

  const integerPart = head.replace(/\D/g, '');
  const fractionPart = groups.join('').replace(/\D/g, '');

  const hasOversizedClass = integerPart.length > 3;

  const padded = integerPart.padStart(DDC_INTEGER_WIDTH, '0');
  const value = fractionPart === '' ? padded : `${padded}.${fractionPart}`;

  return { value, hasOversizedClass, hasNonNumericGroup };
}

export interface NormalizedCutter {
  letters: string;
  digits: string;
  workMark: string;
}

export function normalizeCutter(cutter: string): NormalizedCutter {
  // Los guiones son variación de escritura y no alteran la secuencia observada.
  const cleaned = cutter.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const match = /^([A-Z]*)(\d*)(.*)$/.exec(cleaned);

  return {
    letters: match?.[1] ?? '',
    digits: match?.[2] ?? '',
    workMark: match?.[3] ?? '',
  };
}

/**
 * Construye la clave a partir de un código ya descompuesto.
 *
 * El orden de los componentes reproduce el de docs/clasificacion.md:
 * presencia de prefijo, prefijo, número DDC, letras del Cutter, cifras del Cutter y
 * marca de obra. El separador es el espacio (0x20), menor que dígitos y letras, de
 * modo que un componente más corto precede a otro que lo extiende: así las cifras
 * Cutter se comparan como fracción decimal y los códigos sin prefijo van primero.
 */
export function buildComparableKey(parsed: ParsedCode): string | null {
  if (parsed.isEmpty) return null;

  const prefix = parsed.prefix.toUpperCase();
  const ddc = normalizeDdc(parsed.ddc).value;
  const cutter = normalizeCutter(parsed.cutter);

  const key = [prefix, ddc, cutter.letters, cutter.digits, cutter.workMark].join(
    SEPARATOR,
  );

  return key.length > KEY_MAX_LENGTH ? key.slice(0, KEY_MAX_LENGTH) : key;
}
