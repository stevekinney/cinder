/**
 * Locale-aware numeric parsing.
 *
 * Given a user-typed string, a BCP 47 locale, and an optional
 * `Intl.NumberFormatOptions`, return either:
 *
 * - `{ value: <number>, status: 'valid' }` for a successfully parsed number;
 * - `{ value: null, status: 'empty' }` for an empty/whitespace-only input;
 * - `{ value: null, status: 'malformed' }` for input that doesn't match the
 *   locale's grammar.
 *
 * The parser mirrors how `Intl.NumberFormat` produces strings: localized
 * digits (`ar-EG`, `hi-IN` extended-Arabic), locale separators (`.` in
 * `de-DE`, narrow NBSP in `fr-FR`), and primary/secondary grouping sizes are
 * all derived from probing the formatter. It deliberately stays strict on
 * grouping so a paste of `1,2,3.4` in `en-US` rejects rather than guessing.
 */

export type ParseLocaleNumberResult =
  { value: number; status: 'valid' } | { value: null; status: 'empty' | 'malformed' };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeLocalizedDigits(text: string, locale: string): string {
  let working = text;
  // Localized digit mapping (e.g. ar-EG, hi-IN extended-arabic).
  const digitFormatter = new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 0,
  });
  for (let d = 0; d <= 9; d++) {
    const glyph = digitFormatter.format(d);
    if (glyph !== String(d)) {
      working = working.split(glyph).join(String(d));
    }
  }

  return working;
}

const formatAffixTypes = new Set(['currency', 'percentSign', 'literal', 'unit', 'compact']);

function stripFormatAffixes(
  text: string,
  locale: string,
  format: Intl.NumberFormatOptions | undefined,
): string {
  let working = text;
  let isNegativeByFormatAffix = false;
  if (format) {
    // Strip currency / percent / literal / unit / compact glyphs derived from
    // both positive and negative samples so accounting formats like `($1.00)`
    // round-trip — `formatToParts(0)` alone misses the parentheses.
    const positiveAffixValues = new Set(
      new Intl.NumberFormat(locale, format)
        .formatToParts(0)
        .filter((part) => formatAffixTypes.has(part.type))
        .map((part) => part.value),
    );
    const negativeParts = new Intl.NumberFormat(locale, format).formatToParts(-1);
    const negativeOnlyAffixes = negativeParts
      .filter(
        (part) =>
          formatAffixTypes.has(part.type) &&
          part.value.trim() !== '' &&
          !positiveAffixValues.has(part.value),
      )
      .map((part) => part.value);
    isNegativeByFormatAffix =
      negativeOnlyAffixes.length > 0 && negativeOnlyAffixes.every((part) => working.includes(part));

    const stripSamples = [0, -1];
    for (const sample of stripSamples) {
      const parts = new Intl.NumberFormat(locale, format).formatToParts(sample);
      for (const part of parts) {
        if (formatAffixTypes.has(part.type)) {
          if (part.value) working = working.split(part.value).join('');
        }
      }
    }
  }
  if (isNegativeByFormatAffix && !/^[+-]/.test(working)) {
    working = '-' + working;
  }
  return working;
}

function hasValidGrouping(integerPart: string, groupSep: string, locale: string): boolean {
  if (groupSep && integerPart.includes(groupSep)) {
    const probeParts = new Intl.NumberFormat(locale, {
      useGrouping: true,
    }).formatToParts(12345678);
    const integerRuns: string[] = [];
    for (const p of probeParts) {
      if (p.type === 'integer') integerRuns.push(p.value);
    }
    const primary = integerRuns.length > 0 ? (integerRuns[integerRuns.length - 1] ?? '').length : 3;
    const secondary =
      integerRuns.length > 1 ? (integerRuns[integerRuns.length - 2] ?? '').length : primary;
    const groupEsc = escapeRegex(groupSep);
    const grouped = new RegExp(
      `^[+-]?\\d{1,${secondary}}(${groupEsc}\\d{${secondary}})*${groupEsc}\\d{${primary}}$`,
    );
    return grouped.test(integerPart);
  }

  return true;
}

function parseNumericParts(
  working: string,
  locale: string,
  groupSep: string,
  decimalSep: string,
): ParseLocaleNumberResult {
  if (working === '') return { value: null, status: 'empty' };

  const decimalSplit = working.split(decimalSep);
  if (decimalSplit.length > 2) return { value: null, status: 'malformed' };
  const integerPart = decimalSplit[0] ?? '';
  const fractionPart = decimalSplit[1];

  if (!hasValidGrouping(integerPart, groupSep, locale)) {
    return { value: null, status: 'malformed' };
  }

  let normalized = groupSep.length > 0 ? integerPart.split(groupSep).join('') : integerPart;
  if (fractionPart !== undefined) normalized += '.' + fractionPart;

  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return { value: null, status: 'malformed' };
  }
  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed)) return { value: null, status: 'malformed' };
  return { value: parsed, status: 'valid' };
}

/**
 * Parse a user-typed locale-formatted numeric string. Returns a discriminated
 * result so callers can branch on `'empty'` vs `'malformed'` without losing
 * the parsed value when it's present.
 */
export function parseLocaleNumber(
  text: string,
  locale: string,
  format?: Intl.NumberFormatOptions,
): ParseLocaleNumberResult {
  if (text.trim() === '') return { value: null, status: 'empty' };

  let working = normalizeLocalizedDigits(text, locale);

  // Separator discovery via a plain decimal formatter.
  const sepParts = new Intl.NumberFormat(locale, {
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).formatToParts(-12345.6);
  const groupSep = sepParts.find((p) => p.type === 'group')?.value ?? '';
  const decimalSep = sepParts.find((p) => p.type === 'decimal')?.value ?? '.';

  // Strip Unicode bidi/directional control characters that Intl.NumberFormat
  // inserts as literal parts in RTL locales (e.g. U+061C Arabic Letter Mark
  // in ar-EG). These are invisible and must be removed before regex matching
  // or they cause negative values to be rejected as malformed.
  // Covers: U+061C ALM, U+200E/200F LTR/RTL marks, U+202A–202E bidi embedding,
  // U+2066–2069 bidi isolates.
  working = working.replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');

  // Normalize a localized MINUS SIGN (U+2212) to ASCII hyphen-minus.
  const localeMinus = sepParts.find((p) => p.type === 'minusSign')?.value ?? '-';
  if (localeMinus !== '-') {
    working = working.split(localeMinus).join('-');
  }

  working = stripFormatAffixes(working, locale, format);
  // Always allow a stray percent literal.
  working = working.split('%').join('');

  // Trim leading/trailing whitespace (incl. NBSP variants). Interior whitespace
  // that matches the locale group separator is preserved for the grouping
  // validation below.
  working = working.replace(/^[\s  ]+|[\s  ]+$/g, '');

  return parseNumericParts(working, locale, groupSep, decimalSep);
}
