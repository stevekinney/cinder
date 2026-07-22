/**
 * Truncate text to `maxLength` characters, appending `ellipsis` when the input is longer.
 *
 * If `maxLength` is shorter than (or equal to) the ellipsis itself, the function falls back to
 * a hard slice — there isn't room to fit the ellipsis on top of any content.
 */
export function truncate(text: string, maxLength: number, ellipsis: string = '…'): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= ellipsis.length) return text.slice(0, maxLength);
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}
