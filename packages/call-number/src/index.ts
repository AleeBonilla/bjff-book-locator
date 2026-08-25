export {
  CallNumberNormalizationError,
  IncompatibleCallNumberProfilesError,
  compareNormalizedCallNumbers,
  requireNormalizedCallNumber,
} from './ordering.js';
export {
  byteSuccessor,
  comparableKeyRangeForDdc,
  compareUnsignedBytes,
  encodeComparableKey,
  encodeDdcLogicalPrefix,
  type ComparableKeyRange,
} from './comparable-key.js';
export { normalizeCallNumber } from './normalization.js';
export {
  BASE_NORMALIZATION_PROFILE,
  BASE_NORMALIZATION_PROFILE_ID,
  COMPARABLE_KEY_VERSION,
  NORMALIZED_SCHEMA_VERSION,
  isNormalizedCallNumber,
  type AdditionalComponent,
  type CallNumberSourceMetadata,
  type CutterComponent,
  type DdcComponent,
  type FailedNormalizationResult,
  type NormalizationIssue,
  type NormalizationIssueCode,
  type NormalizationProfile,
  type NormalizationResult,
  type NormalizationStatus,
  type NormalizedCallNumber,
  type NormalizeCallNumberOptions,
  type UnclassifiedAdditionalComponent,
  type WorkmarkComponent,
} from './types.js';
