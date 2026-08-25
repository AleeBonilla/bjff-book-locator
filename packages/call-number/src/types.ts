export const NORMALIZED_SCHEMA_VERSION = 1 as const;
export const BASE_NORMALIZATION_PROFILE_ID = 'base-1' as const;
export const COMPARABLE_KEY_VERSION = 1 as const;

export type NormalizationStatus = 'ok' | 'ambiguous' | 'invalid';

export type NormalizationIssueCode =
  | 'EMPTY_INPUT'
  | 'INPUT_TOO_LONG'
  | 'MISSING_DDC'
  | 'INVALID_DDC_SYNTAX'
  | 'NONCANONICAL_DDC_TRAILING_ZERO'
  | 'INVALID_CUTTER'
  | 'EMPTY_WORKMARK_SEGMENT'
  | 'DETACHED_SUFFIX'
  | 'UNIDENTIFIED_TRAILING_NUMBER'
  | 'UNSUPPORTED_CHARACTER'
  | 'CONFLICTING_SOURCE_METADATA'
  | 'UNVERIFIED_EDITION_PROJECTION';

export interface NormalizationIssue {
  code: NormalizationIssueCode;
  message: string;
  severity: 'warning' | 'error';
}

export interface DdcComponent {
  class_digits: string;
  fractional_digits: string;
  canonical: string;
}

export interface CutterComponent {
  letters: string;
  digits: string;
}

export interface WorkmarkComponent {
  segments: string[];
}

export interface UnclassifiedAdditionalComponent {
  kind: 'unclassified';
  value: string;
}

export type AdditionalComponent = UnclassifiedAdditionalComponent;

interface NormalizationResultBase {
  schema_version: typeof NORMALIZED_SCHEMA_VERSION;
  normalization_profile: string;
  prefix: string | null;
  cutter: CutterComponent | null;
  workmark: WorkmarkComponent | null;
  ddc_edition: string | null;
  additional_components: AdditionalComponent[];
  issues: NormalizationIssue[];
}

export interface NormalizedCallNumber extends NormalizationResultBase {
  status: 'ok';
  ddc: DdcComponent;
}

export interface FailedNormalizationResult extends NormalizationResultBase {
  status: 'ambiguous' | 'invalid';
  ddc: DdcComponent | null;
}

export type NormalizationResult = NormalizedCallNumber | FailedNormalizationResult;

export interface NormalizationProfile {
  id: string;
  maxInputLength: number;
  noncanonicalDdcTrailingZero: 'reject' | 'preserve';
}

export interface CallNumberSourceMetadata {
  ddcEdition?: string;
  textualEditionIsRedundant?: boolean;
}

export interface NormalizeCallNumberOptions {
  profile?: NormalizationProfile;
  metadata?: CallNumberSourceMetadata;
}

export const BASE_NORMALIZATION_PROFILE: Readonly<NormalizationProfile> = Object.freeze({
  id: BASE_NORMALIZATION_PROFILE_ID,
  maxInputLength: 512,
  noncanonicalDdcTrailingZero: 'reject',
});

export function isNormalizedCallNumber(
  result: NormalizationResult,
): result is NormalizedCallNumber {
  return result.status === 'ok';
}
