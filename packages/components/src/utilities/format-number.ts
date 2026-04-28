/**
 * Format a number with explicit locale and `Intl.NumberFormat` options.
 *
 * Defaults to `en-US` so call sites stay deterministic across machines and CI shards.
 * Pass an options object to control fraction digits, grouping, currency, etc.
 */
export function formatNumber(
  value: number,
  locale: string = 'en-US',
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}
