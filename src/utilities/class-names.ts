/**
 * Join truthy class-name strings, dropping falsy entries.
 * Accepts any number of string | null | undefined | false inputs.
 */
export function cn(...parts: Array<string | null | undefined | false>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
}
