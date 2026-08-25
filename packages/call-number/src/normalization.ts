import { foldAlphanumeric, foldLatinLetters } from './characters.js';
import {
  BASE_NORMALIZATION_PROFILE,
  BASE_NORMALIZATION_PROFILE_ID,
  NORMALIZED_SCHEMA_VERSION,
  type AdditionalComponent,
  type CallNumberSourceMetadata,
  type CutterComponent,
  type DdcComponent,
  type NormalizationIssue,
  type NormalizationIssueCode,
  type NormalizationProfile,
  type NormalizationResult,
  type NormalizeCallNumberOptions,
  type WorkmarkComponent,
} from './types.js';

type IssueStatus = 'warning' | 'ambiguous' | 'invalid';

interface TrackedIssue extends NormalizationIssue {
  status: IssueStatus;
}

interface ParsedMainComponent {
  prefix: string | null;
  ddc: DdcComponent | null;
  nextTokenIndex: number;
}

const LETTERS_PATTERN = /^\p{L}+$/u;
const DDC_PATTERN = /^(\d{3})(?:\.(\d+))?$/;
const ADJACENT_PREFIX_DDC_PATTERN = /^(\p{L}+)(\d{3}(?:\.\d+)?)$/u;
const CUTTER_PATTERN = /^(\p{L}+)(\d+)(.*)$/u;
const ALLOWED_INPUT_CHARACTER_PATTERN = /^[\p{L}\p{M}0-9.\-\s]$/u;

function issue(
  code: NormalizationIssueCode,
  message: string,
  status: IssueStatus,
): TrackedIssue {
  return {
    code,
    message,
    severity: status === 'warning' ? 'warning' : 'error',
    status,
  };
}

function parseDdc(token: string): DdcComponent | null {
  const match = DDC_PATTERN.exec(token);
  if (match === null) {
    return null;
  }

  const classDigits = match[1];
  if (classDigits === undefined) {
    return null;
  }

  const fractionalDigits = match[2] ?? '';
  return {
    class_digits: classDigits,
    fractional_digits: fractionalDigits,
    canonical:
      fractionalDigits.length === 0
        ? classDigits
        : `${classDigits}.${fractionalDigits}`,
  };
}

function looksLikeMalformedDdc(token: string): boolean {
  return /\d/.test(token) || token.includes('.');
}

function parseMainComponent(tokens: string[], issues: TrackedIssue[]): ParsedMainComponent {
  const first = tokens[0];
  if (first === undefined) {
    return { prefix: null, ddc: null, nextTokenIndex: 0 };
  }

  const directDdc = parseDdc(first);
  if (directDdc !== null) {
    return { prefix: null, ddc: directDdc, nextTokenIndex: 1 };
  }

  const adjacentMatch = ADJACENT_PREFIX_DDC_PATTERN.exec(first);
  if (adjacentMatch !== null) {
    const rawPrefix = adjacentMatch[1];
    const rawDdc = adjacentMatch[2];
    if (rawPrefix !== undefined && rawDdc !== undefined) {
      const prefix = foldLatinLetters(rawPrefix);
      const ddc = parseDdc(rawDdc);
      if (prefix !== null && ddc !== null) {
        return { prefix, ddc, nextTokenIndex: 1 };
      }
    }
  }

  const second = tokens[1];
  if (LETTERS_PATTERN.test(first) && second !== undefined) {
    const prefix = foldLatinLetters(first);
    const ddc = parseDdc(second);
    if (prefix !== null && ddc !== null) {
      return { prefix, ddc, nextTokenIndex: 2 };
    }

    issues.push(
      issue(
        looksLikeMalformedDdc(second) ? 'INVALID_DDC_SYNTAX' : 'MISSING_DDC',
        looksLikeMalformedDdc(second)
          ? 'El número DDC no cumple la forma DDD[.DIGITS].'
          : 'No se localizó un número DDC de tres dígitos.',
        'invalid',
      ),
    );
    return { prefix, ddc: null, nextTokenIndex: 2 };
  }

  issues.push(
    issue(
      looksLikeMalformedDdc(first) ? 'INVALID_DDC_SYNTAX' : 'MISSING_DDC',
      looksLikeMalformedDdc(first)
        ? 'El número DDC no cumple la forma DDD[.DIGITS].'
        : 'No se localizó un número DDC de tres dígitos.',
      'invalid',
    ),
  );
  return { prefix: null, ddc: null, nextTokenIndex: 1 };
}

function parseWorkmark(raw: string, issues: TrackedIssue[]): WorkmarkComponent | null {
  if (raw.length === 0) {
    return null;
  }

  const withoutInitialSeparator = raw.startsWith('-') ? raw.slice(1) : raw;
  const rawSegments = withoutInitialSeparator.split('-');

  if (rawSegments.some((segment) => segment.length === 0)) {
    issues.push(
      issue(
        'EMPTY_WORKMARK_SEGMENT',
        'La marca de obra contiene una frontera sin contenido.',
        'invalid',
      ),
    );
    return null;
  }

  const segments: string[] = [];
  for (const rawSegment of rawSegments) {
    const segment = foldAlphanumeric(rawSegment);
    if (segment === null || segment.length === 0) {
      issues.push(
        issue(
          'UNSUPPORTED_CHARACTER',
          'La marca de obra contiene un carácter sin equivalencia en el perfil.',
          'invalid',
        ),
      );
      return null;
    }
    segments.push(segment);
  }

  return { segments };
}

function validateProfile(profile: NormalizationProfile): void {
  if (!Number.isSafeInteger(profile.maxInputLength) || profile.maxInputLength < 1) {
    throw new RangeError('profile.maxInputLength debe ser un entero positivo.');
  }
  if (profile.id.trim().length === 0) {
    throw new RangeError('profile.id no puede estar vacío.');
  }
  if (
    profile.id === BASE_NORMALIZATION_PROFILE_ID &&
    profile.noncanonicalDdcTrailingZero !== 'reject'
  ) {
    throw new RangeError('El perfil base-1 debe rechazar ceros DDC finales no canónicos.');
  }
}

function findUnsupportedInputCharacter(input: string): string | null {
  for (const character of input) {
    if (!ALLOWED_INPUT_CHARACTER_PATTERN.test(character)) {
      return character;
    }
  }
  return null;
}

function applyEditionMetadata(
  metadata: CallNumberSourceMetadata | undefined,
  additionalComponents: AdditionalComponent[],
  issues: TrackedIssue[],
): string | null {
  if (metadata?.ddcEdition === undefined) {
    const last = additionalComponents.at(-1);
    if (last !== undefined && /^\d+$/.test(last.value)) {
      issues.push(
        issue(
          'UNIDENTIFIED_TRAILING_NUMBER',
          'El número final se conservó sin inferir que representa una edición DDC.',
          'warning',
        ),
      );
    }
    return null;
  }

  if (!/^\d+$/.test(metadata.ddcEdition)) {
    issues.push(
      issue(
        'CONFLICTING_SOURCE_METADATA',
        'La edición DDC estructurada debe contener solo dígitos.',
        'ambiguous',
      ),
    );
    return null;
  }

  const last = additionalComponents.at(-1);
  const hasTextualCandidate = last !== undefined && /^\d+$/.test(last.value);
  if (!hasTextualCandidate) {
    return metadata.ddcEdition;
  }

  if (last.value !== metadata.ddcEdition) {
    issues.push(
      issue(
        'CONFLICTING_SOURCE_METADATA',
        'El número final y la edición DDC estructurada no concuerdan.',
        'ambiguous',
      ),
    );
    return metadata.ddcEdition;
  }

  if (metadata.textualEditionIsRedundant !== true) {
    issues.push(
      issue(
        'UNVERIFIED_EDITION_PROJECTION',
        'Falta confirmar que el número final es una proyección redundante de la edición DDC.',
        'ambiguous',
      ),
    );
    return metadata.ddcEdition;
  }

  additionalComponents.pop();
  return metadata.ddcEdition;
}

function publicIssues(issues: TrackedIssue[]): NormalizationIssue[] {
  return issues.map(({ code, message, severity }) => ({ code, message, severity }));
}

export function normalizeCallNumber(
  input: string,
  options: NormalizeCallNumberOptions = {},
): NormalizationResult {
  const profile = options.profile ?? BASE_NORMALIZATION_PROFILE;
  validateProfile(profile);

  const trackedIssues: TrackedIssue[] = [];
  let logicalInput = input.trim().replace(/[\r\n\t\f\v ]+/g, ' ').normalize('NFC');

  if (logicalInput.length === 0) {
    trackedIssues.push(issue('EMPTY_INPUT', 'La signatura no contiene texto útil.', 'invalid'));
  }

  if (input.length > profile.maxInputLength) {
    trackedIssues.push(
      issue(
        'INPUT_TOO_LONG',
        `La signatura excede el límite de ${profile.maxInputLength} caracteres.`,
        'invalid',
      ),
    );
    logicalInput = logicalInput.slice(0, profile.maxInputLength);
  }

  const unsupportedCharacter = findUnsupportedInputCharacter(logicalInput);
  if (unsupportedCharacter !== null) {
    trackedIssues.push(
      issue(
        'UNSUPPORTED_CHARACTER',
        `El perfil no define una equivalencia para ${JSON.stringify(unsupportedCharacter)}.`,
        'invalid',
      ),
    );
  }

  const tokens = logicalInput.length === 0 ? [] : logicalInput.split(' ');
  const main = parseMainComponent(tokens, trackedIssues);

  if (
    main.ddc !== null &&
    main.ddc.fractional_digits.endsWith('0')
  ) {
    trackedIssues.push(
      issue(
        'NONCANONICAL_DDC_TRAILING_ZERO',
        'El número DDC termina en cero a la derecha del punto.',
        profile.noncanonicalDdcTrailingZero === 'reject' ? 'invalid' : 'warning',
      ),
    );
  }

  let cutter: CutterComponent | null = null;
  let workmark: WorkmarkComponent | null = null;
  let tailStart = main.nextTokenIndex;
  const possibleCutter = tokens[main.nextTokenIndex];

  if (possibleCutter !== undefined && /^\p{L}/u.test(possibleCutter)) {
    const cutterMatch = CUTTER_PATTERN.exec(possibleCutter);
    if (cutterMatch === null) {
      trackedIssues.push(
        issue(
          'INVALID_CUTTER',
          'El candidato a Cutter debe contener letras seguidas por una secuencia de dígitos.',
          'invalid',
        ),
      );
      tailStart += 1;
    } else {
      const rawLetters = cutterMatch[1] ?? '';
      const digits = cutterMatch[2] ?? '';
      const rawWorkmark = cutterMatch[3] ?? '';
      const letters = foldLatinLetters(rawLetters);

      if (letters === null || letters.length === 0 || digits.length === 0) {
        trackedIssues.push(
          issue(
            'INVALID_CUTTER',
            'El candidato a Cutter contiene letras o cifras no válidas.',
            'invalid',
          ),
        );
      } else {
        cutter = { letters, digits };
        workmark = parseWorkmark(rawWorkmark, trackedIssues);
      }
      tailStart += 1;
    }
  }

  const additionalComponents: AdditionalComponent[] = [];
  const tail = tokens.slice(tailStart);
  for (const rawComponent of tail) {
    const value = foldAlphanumeric(rawComponent);
    if (value === null || value.length === 0) {
      trackedIssues.push(
        issue(
          'UNSUPPORTED_CHARACTER',
          'Un componente adicional contiene un carácter sin equivalencia en el perfil.',
          'invalid',
        ),
      );
      continue;
    }
    additionalComponents.push({ kind: 'unclassified', value });
  }

  const ddcEdition = applyEditionMetadata(
    options.metadata,
    additionalComponents,
    trackedIssues,
  );

  if (additionalComponents.length > 0 && cutter !== null) {
    const detachedSuffixIssue = issue(
      'DETACHED_SUFFIX',
      'El sufijo separado no se fusionó con la marca de obra.',
      'warning',
    );
    const unidentifiedNumberIndex = trackedIssues.findIndex(
      ({ code }) => code === 'UNIDENTIFIED_TRAILING_NUMBER',
    );
    if (unidentifiedNumberIndex === -1) {
      trackedIssues.push(detachedSuffixIssue);
    } else {
      trackedIssues.splice(unidentifiedNumberIndex, 0, detachedSuffixIssue);
    }
  }

  const status = trackedIssues.some((item) => item.status === 'invalid')
    ? 'invalid'
    : trackedIssues.some((item) => item.status === 'ambiguous')
      ? 'ambiguous'
      : 'ok';

  const common = {
    schema_version: NORMALIZED_SCHEMA_VERSION,
    normalization_profile: profile.id,
    prefix: main.prefix,
    cutter,
    workmark,
    ddc_edition: ddcEdition,
    additional_components: additionalComponents,
    issues: publicIssues(trackedIssues),
  };

  if (status === 'ok' && main.ddc !== null) {
    return { ...common, status, ddc: main.ddc };
  }

  return { ...common, status: status === 'ok' ? 'invalid' : status, ddc: main.ddc };
}
