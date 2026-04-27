/**
 * Join truthy class-name strings, dropping falsy entries.
 * Accepts any number of string | null | undefined | false inputs.
 */
export function classNames(...parts: Array<string | null | undefined | false>): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
}

export const cn = classNames;
