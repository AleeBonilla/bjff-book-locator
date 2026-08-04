import { buildComparableKey, parseClassification } from '@bjff/classification';

const SEARCH_CODE_CHARACTERS = /^[A-Za-z0-9.,\-\s]+$/;

/**
 * Devuelve una clave solo cuando la consulta tiene una lectura catalográfica única.
 * La importación conserva casos ambiguos para revisión, pero una búsqueda no debe
 * convertirlos silenciosamente en una ubicación aproximada.
 */
export function searchableClassificationKey(source: string): string | null {
  const parsed = parseClassification(source);
  const isUnambiguous =
    SEARCH_CODE_CHARACTERS.test(source) &&
    /\d/.test(parsed.ddc) &&
    /^[\d.,]+$/.test(parsed.ddc) &&
    parsed.extraSegments.length === 0;

  return isUnambiguous ? buildComparableKey(parsed) : null;
}
