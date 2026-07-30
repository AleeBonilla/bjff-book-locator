import { normalizeDdc } from './comparable-key.js';
import { DOCUMENTED_PREFIXES, type ParsedCode } from './parse.js';

/**
 * Motivos por los que una fila se marca para revisión catalográfica.
 *
 * Criterio de FR-017a: se marca lo que admite **más de una lectura**, no todo lo que
 * se aparta de la forma canónica. Lo que se normaliza de forma determinista —coma
 * decimal, agrupamiento de dígitos con espacios o con puntos, espacio pegado al punto,
 * espacio junto a un guion, marca de obra separada y Cutter repetido— no se marca:
 * conserva su valor original y no exige decisión de nadie.
 *
 * Un motivo nunca impide importar la fila.
 */
export type ReviewReason =
  /** Más de tres dígitos antes del punto: la DDC lo sitúa tras el tercero (FR-018a). */
  | 'FOUR_DIGIT_CLASS'
  /** Un bloque posterior al primer punto no es numérico (FR-018b). */
  | 'NON_NUMERIC_GROUP'
  /** Segmento que no se explica como Cutter, marca de obra ni repetición (FR-025b). */
  | 'AMBIGUOUS_SEGMENT'
  /** Prefijo alfabético fuera de la tabla documentada (FR-025c). */
  | 'UNDOCUMENTED_PREFIX';

/** Texto mostrado al personal en el listado de problemas (FR-038). */
export const REVIEW_REASON_TEXT: Record<ReviewReason, string> = {
  FOUR_DIGIT_CLASS: 'Más de tres dígitos antes del punto DDC.',
  NON_NUMERIC_GROUP: 'El número DDC tiene un bloque que no es numérico.',
  AMBIGUOUS_SEGMENT: 'Segmento que no se explica como Cutter ni marca de obra.',
  UNDOCUMENTED_PREFIX: 'Prefijo de país no documentado.',
};

export function detectReviewReasons(parsed: ParsedCode): ReviewReason[] {
  if (parsed.isEmpty) return [];

  const reasons: ReviewReason[] = [];
  const ddc = normalizeDdc(parsed.ddc);

  if (ddc.hasOversizedClass) reasons.push('FOUR_DIGIT_CLASS');
  if (ddc.hasNonNumericGroup) reasons.push('NON_NUMERIC_GROUP');
  if (parsed.extraSegments.length > 0) reasons.push('AMBIGUOUS_SEGMENT');

  if (parsed.prefix !== '' && !DOCUMENTED_PREFIXES.has(parsed.prefix.toUpperCase())) {
    reasons.push('UNDOCUMENTED_PREFIX');
  }

  return reasons;
}
