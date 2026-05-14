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
  | { value: number; status: 'valid' }
  | { value: null; status: 'empty' | 'malformed' };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  // Separator discovery via a plain decimal formatter.
  const sepParts = new Intl.NumberFormat(locale, {
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).formatToParts(-12345.6);
  const groupSep = sepParts.find((p) => p.type === 'group')?.value ?? '';
  const decimalSep = sepParts.find((p) => p.type === 'decimal')?.value ?? '.';

  let isNegativeByFormatAffix = false;
  if (format) {
    // Strip currency / percent / literal / unit / compact glyphs derived from
    // both positive and negative samples so accounting formats like `($1.00)`
    // round-trip — `formatToParts(0)` alone misses the parentheses.
    const positiveAffixValues = new Set(
      new Intl.NumberFormat(locale, format)
        .formatToParts(0)
        .filter(
          (part) =>
            part.type === 'currency' ||
            part.type === 'percentSign' ||
            part.type === 'literal' ||
            part.type === 'unit' ||
            part.type === 'compact',
        )
        .map((part) => part.value),
    );
    const negativeParts = new Intl.NumberFormat(locale, format).formatToParts(-1);
    const negativeOnlyAffixes = negativeParts
      .filter(
        (part) =>
          (part.type === 'currency' ||
            part.type === 'percentSign' ||
            part.type === 'literal' ||
            part.type === 'unit' ||
            part.type === 'compact') &&
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
        if (
          part.type === 'currency' ||
          part.type === 'percentSign' ||
          part.type === 'literal' ||
          part.type === 'unit' ||
          part.type === 'compact'
        ) {
          if (part.value) working = working.split(part.value).join('');
        }
      }
    }
  }
  if (isNegativeByFormatAffix && !/^[+-]/.test(working)) {
    working = '-' + working;
  }
  // Always allow a stray percent literal.
  working = working.split('%').join('');

  // Trim leading/trailing whitespace (incl. NBSP variants). Interior whitespace
  // that matches the locale group separator is preserved for the grouping
  // validation below.
  working = working.replace(/^[\s  ]+|[\s  ]+$/g, '');

  if (working === '') return { value: null, status: 'empty' };

  const decimalSplit = working.split(decimalSep);
  if (decimalSplit.length > 2) return { value: null, status: 'malformed' };
  const integerPart = decimalSplit[0] ?? '';
  const fractionPart = decimalSplit[1];

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
    if (!grouped.test(integerPart)) return { value: null, status: 'malformed' };
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
