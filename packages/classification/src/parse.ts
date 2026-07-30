/**
 * Descomposición de un código de clasificación.
 *
 * Reglas normativas: docs/clasificacion.md. Este módulo no decide si un código es
 * válido: lo separa en sus componentes y anota lo que no pudo explicar.
 */

/** Prefijos de país documentados, en mayúsculas. `CU` y `Cu` son el mismo. */
export const DOCUMENTED_PREFIXES: ReadonlySet<string> = new Set([
  'A',
  'C',
  'CH',
  'CR',
  'CU',
  'ES',
  'G',
  'M',
  'N',
  'P',
  'PE',
  'U',
  'V',
]);

export interface ParsedCode {
  /** Valor recibido, sin alterar (FR-016). */
  raw: string;
  /** No hay código utilizable: ausente o compuesto solo por separadores. */
  isEmpty: boolean;
  /** Prefijo alfabético de país, tal como venía escrito. */
  prefix: string;
  /** Número de clase DDC, con los bloques de dígitos ya unidos. */
  ddc: string;
  /** Segmento Cutter, ya reunido si venía partido. */
  cutter: string;
  /** Indicador de edición DDC. Solo se separa cuando existe Cutter. */
  editionIndicator: string;
  /**
   * Segmentos que no se explican por ninguna convención conocida. Son los únicos que
   * obligan a revisión (FR-025b); las variaciones de escritura de FR-025a ya se
   * absorbieron aquí.
   */
  extraSegments: string[];
}

const ONLY_SEPARATORS = /^[\s.,-]*$/;
const LEADING_LETTERS = /^[A-Za-z]+/;
const NUMERIC_SEGMENT = /^[\d.,]+$/;
const DIGITS_ONLY = /^\d+$/;

/**
 * El Cutter se reconoce por su forma: una o varias letras seguidas de al menos un
 * dígito. Los guiones se ignoran porque son variación de escritura.
 */
function looksLikeCutter(segment: string): boolean {
  return /^[A-Za-z]+\d/.test(segment.replace(/-/g, ''));
}

/**
 * Marca de obra suelta, como `p`, `ci` o `m5`.
 *
 * Se exige minúscula inicial porque así se escriben en la colección. Un token en
 * mayúsculas tiene más probabilidad de ser ruido, y ante la duda conviene marcar la
 * fila antes que absorber el segmento en silencio.
 */
function looksLikeWorkMark(segment: string): boolean {
  return /^[a-z][a-z0-9]{0,2}$/.test(segment);
}

/** Forma comparable de un segmento, para detectar repeticiones literales. */
function shapeOf(segment: string): string {
  return segment.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Reúne los segmentos partidos por un espacio junto a un guion: `C8374- lge` y
 * `I584 -i` son un único Cutter (FR-025a).
 */
function joinHyphenSplits(segments: string[]): string[] {
  const joined: string[] = [];

  for (const segment of segments) {
    const previous = joined[joined.length - 1];
    if (previous !== undefined && (previous.endsWith('-') || segment.startsWith('-'))) {
      joined[joined.length - 1] = previous + segment;
      continue;
    }
    joined.push(segment);
  }

  return joined;
}

function emptyResult(raw: string): ParsedCode {
  return {
    raw,
    isEmpty: true,
    prefix: '',
    ddc: '',
    cutter: '',
    editionIndicator: '',
    extraSegments: [],
  };
}

export function parseClassification(raw: string | null | undefined): ParsedCode {
  const source = raw ?? '';
  const trimmed = source.trim();

  if (trimmed === '' || ONLY_SEPARATORS.test(trimmed)) {
    return emptyResult(source);
  }

  const segments = trimmed.split(/\s+/);
  const first = segments[0] ?? '';

  const prefixMatch = LEADING_LETTERS.exec(first);
  const prefix = prefixMatch ? prefixMatch[0] : '';

  let ddc = first.slice(prefix.length);
  let index = 1;

  // Los bloques de dígitos posteriores al primer segmento pertenecen al número DDC:
  // es el agrupamiento Dewey escrito con espacios (FR-018).
  while (index < segments.length && NUMERIC_SEGMENT.test(segments[index] ?? '')) {
    ddc += segments[index];
    index += 1;
  }

  const rest = joinHyphenSplits(segments.slice(index));
  const cutterIndex = rest.findIndex(looksLikeCutter);

  if (cutterIndex === -1) {
    return {
      raw: source,
      isEmpty: false,
      prefix,
      ddc,
      cutter: '',
      editionIndicator: '',
      extraSegments: rest,
    };
  }

  let cutter = rest[cutterIndex] ?? '';
  const before = rest.slice(0, cutterIndex);
  const after = rest.slice(cutterIndex + 1);

  // El indicador de edición solo se retira cuando existe Cutter (FR-017).
  let editionIndicator = '';
  const last = after[after.length - 1];
  if (last !== undefined && DIGITS_ONLY.test(last)) {
    editionIndicator = last;
    after.pop();
  }

  // Repetición literal del Cutter: `C659ci C659ci` (FR-025a).
  if (after.length > 0 && shapeOf(after[0] ?? '') === shapeOf(cutter)) {
    after.shift();
  }

  // Marca de obra separada por un espacio, cuando es lo único que resta: `C146 p`
  // (FR-025a). Si quedara más de un segmento, no se puede afirmar que sea la marca.
  if (after.length === 1 && looksLikeWorkMark(after[0] ?? '')) {
    cutter += after[0];
    after.pop();
  }

  return {
    raw: source,
    isEmpty: false,
    prefix,
    ddc,
    cutter,
    editionIndicator,
    extraSegments: [...before, ...after],
  };
}
