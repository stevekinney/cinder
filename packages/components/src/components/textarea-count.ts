/**
 * Parses a `maxlength` prop value into a usable integer, mirroring the HTML
 * non-negative-integer attribute parser. Accepts digit-only strings (with
 * optional surrounding whitespace or leading zeros) and safe non-negative
 * integers. Rejects negative values, decimals, exponents, signs, empty strings,
 * and internal whitespace.
 */
export function resolveMaximumLength(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return undefined;
    const parsed = Number(trimmed);
    return parsed >= 0 && Number.isSafeInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}
