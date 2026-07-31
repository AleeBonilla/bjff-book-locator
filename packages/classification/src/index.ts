/**
 * Normalización y orden de los códigos de clasificación de la BJFF.
 *
 * Es el módulo clave que nombra el principio V de la constitución: la importación, la
 * distribución y la búsqueda pública deben usar esta misma función para que el orden
 * sea determinista y comparable.
 *
 * El paquete no depende de ningún framework y se prueba sin infraestructura.
 */

export {
  KEY_MAX_LENGTH,
  KEY_UPPER_SENTINEL,
  buildComparableKey,
  normalizeCutter,
  normalizeDdc,
} from './comparable-key.js';
export { DOCUMENTED_PREFIXES, parseClassification, type ParsedCode } from './parse.js';
export {
  REVIEW_REASON_TEXT,
  detectReviewReasons,
  type ReviewReason,
} from './review-reasons.js';

import { buildComparableKey } from './comparable-key.js';
import { parseClassification } from './parse.js';
import { detectReviewReasons, type ReviewReason } from './review-reasons.js';

export interface DerivedClassification {
  /** Valor recibido, sin alterar (FR-016). */
  raw: string;
  /** No hay código utilizable: el registro se importa sin clave (FR-024). */
  isEmpty: boolean;
  /** Clave normalizada y ordenable, o `null` si no hay código. */
  comparableKey: string | null;
  /** Motivos de revisión. Vacío cuando el código es canónico. */
  reviewReasons: ReviewReason[];
}

/**
 * Deriva de un código su clave comparable y sus motivos de revisión.
 *
 * Es la única entrada que debería usar el resto del sistema.
 */
export function deriveClassification(
  raw: string | null | undefined,
): DerivedClassification {
  const parsed = parseClassification(raw);

  return {
    raw: parsed.raw,
    isEmpty: parsed.isEmpty,
    comparableKey: buildComparableKey(parsed),
    reviewReasons: detectReviewReasons(parsed),
  };
}

/** Atajo para obtener solo la clave. */
export function comparableKey(raw: string | null | undefined): string | null {
  return buildComparableKey(parseClassification(raw));
}
