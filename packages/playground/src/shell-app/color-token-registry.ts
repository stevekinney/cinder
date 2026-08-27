import { COLOR_TOKEN_GROUPS } from './color-token-registry.generated.ts';

export type { ColorToken, ColorTokenGroup } from './color-token-registry.generated.ts';
export { COLOR_TOKEN_GROUPS };

export type ColorTokenName = (typeof COLOR_TOKEN_GROUPS)[number]['tokens'][number]['name'];

export type ColorTokenOverrides = Partial<Record<ColorTokenName, string>>;

export const COLOR_TOKEN_NAMES = COLOR_TOKEN_GROUPS.flatMap((group) =>
  group.tokens.map((token) => token.name),
);

export const COLOR_TOKEN_NAME_SET: ReadonlySet<string> = new Set(COLOR_TOKEN_NAMES);

export const MAX_COLOR_TOKEN_VALUE_LENGTH = 240;
export const BLOCKED_COLOR_VALUE_PATTERN = /[;{}<>]|\/\*|\*\//;
export const FALLBACK_COLOR_VALUE_PATTERN =
  /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgb|rgba|hsl|hsla|oklch|oklab|lch|lab|color|color-mix|light-dark)\([^;{}<>]+\)|var\(--cinder-[a-z0-9-]+\)|transparent|currentcolor|black|white)$/;
export const COLOR_VALUE_VARIABLE_REFERENCE_PATTERN = /var\(([^)]*)\)/gi;
export const SAFE_COLOR_VALUE_VARIABLE_NAME_PATTERN = /^--cinder-[a-z0-9-]+$/i;

export function isColorTokenName(value: string): value is ColorTokenName {
  return COLOR_TOKEN_NAME_SET.has(value);
}

export function hasOnlySafeColorTokenVariableReferences(value: string): boolean {
  if (!value.toLowerCase().includes('var(')) return true;

  COLOR_VALUE_VARIABLE_REFERENCE_PATTERN.lastIndex = 0;
  const references = [...value.matchAll(COLOR_VALUE_VARIABLE_REFERENCE_PATTERN)];
  COLOR_VALUE_VARIABLE_REFERENCE_PATTERN.lastIndex = 0;
  if (references.length === 0) return false;

  for (const reference of references) {
    const variableName = reference[1]?.trim();
    if (variableName === undefined || !SAFE_COLOR_VALUE_VARIABLE_NAME_PATTERN.test(variableName)) {
      return false;
    }
  }

  const withoutReferences = value.replace(COLOR_VALUE_VARIABLE_REFERENCE_PATTERN, '');
  COLOR_VALUE_VARIABLE_REFERENCE_PATTERN.lastIndex = 0;
  return !withoutReferences.toLowerCase().includes('var(');
}

export function isSafeColorTokenValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_COLOR_TOKEN_VALUE_LENGTH) return false;
  if (BLOCKED_COLOR_VALUE_PATTERN.test(trimmed)) return false;
  if (trimmed.toLowerCase().includes('url(')) return false;
  if (!hasOnlySafeColorTokenVariableReferences(trimmed)) return false;

  const lowercased = trimmed.toLowerCase();
  if (!FALLBACK_COLOR_VALUE_PATTERN.test(lowercased)) return false;

  const css = globalThis.CSS;
  if (css !== undefined && typeof css.supports === 'function') {
    return css.supports('color', trimmed);
  }

  return true;
}
