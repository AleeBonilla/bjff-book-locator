const NONTRIVIAL_LATIN_FOLDS: Readonly<Record<string, string>> = Object.freeze({
  'Æ': 'AE',
  'æ': 'AE',
  'Œ': 'OE',
  'œ': 'OE',
  'Þ': 'TH',
  'þ': 'TH',
  'Ð': 'D',
  'ð': 'D',
  'ı': 'I',
  'Ł': 'L',
  'ł': 'L',
  'Ø': 'O',
  'ø': 'O',
  'Đ': 'D',
  'đ': 'D',
  'Ħ': 'H',
  'ħ': 'H',
  'Ŋ': 'N',
  'ŋ': 'N',
  'ſ': 'S',
  'Ŧ': 'T',
  'ŧ': 'T',
});

export function foldLatinLetters(value: string): string | null {
  let folded = '';

  for (const character of value) {
    const mapped = NONTRIVIAL_LATIN_FOLDS[character];
    if (mapped !== undefined) {
      folded += mapped;
      continue;
    }

    const decomposed = character.normalize('NFD').replace(/\p{M}/gu, '');
    if (!/^[A-Za-z]+$/.test(decomposed)) {
      return null;
    }

    folded += decomposed.toUpperCase();
  }

  return folded;
}

export function foldAlphanumeric(value: string): string | null {
  let folded = '';
  let pendingLetters = '';

  const flushLetters = (): boolean => {
    if (pendingLetters.length === 0) {
      return true;
    }

    const canonical = foldLatinLetters(pendingLetters);
    pendingLetters = '';
    if (canonical === null) {
      return false;
    }

    folded += canonical;
    return true;
  };

  for (const character of value) {
    if (/^[0-9]$/.test(character)) {
      if (!flushLetters()) {
        return null;
      }
      folded += character;
      continue;
    }

    if (/^\p{L}$/u.test(character)) {
      pendingLetters += character;
      continue;
    }

    return null;
  }

  return flushLetters() ? folded : null;
}

export function compareCanonicalText(left: string, right: string): -1 | 0 | 1 {
  const length = Math.min(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftCode = left.charCodeAt(index);
    const rightCode = right.charCodeAt(index);
    if (leftCode < rightCode) {
      return -1;
    }
    if (leftCode > rightCode) {
      return 1;
    }
  }

  if (left.length < right.length) {
    return -1;
  }
  if (left.length > right.length) {
    return 1;
  }
  return 0;
}
