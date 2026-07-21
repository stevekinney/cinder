export type ColorToken = {
  name: string;
  label: string;
};

export type ColorTokenGroup = {
  id: string;
  label: string;
  tokens: readonly ColorToken[];
};

export const COLOR_TOKEN_GROUPS = [
  {
    id: 'accent',
    label: 'Accent',
    tokens: [
      { name: '--cinder-accent', label: 'Accent fill' },
      { name: '--cinder-accent-contrast', label: 'Accent contrast' },
      { name: '--cinder-accent-text', label: 'Accent text' },
      { name: '--cinder-accent-text-hover', label: 'Accent text hover' },
      { name: '--cinder-accent-hover', label: 'Accent fill hover' },
      { name: '--cinder-accent-active', label: 'Accent fill active' },
      { name: '--cinder-accent-active-on-fill', label: 'Accent active on fill' },
    ],
  },
  {
    id: 'status-solid',
    label: 'Status Solids',
    tokens: [
      { name: '--cinder-info', label: 'Info' },
      { name: '--cinder-success', label: 'Success' },
      { name: '--cinder-warning', label: 'Warning' },
      { name: '--cinder-danger', label: 'Danger' },
      { name: '--cinder-info-contrast', label: 'Info contrast' },
      { name: '--cinder-success-contrast', label: 'Success contrast' },
      { name: '--cinder-warning-contrast', label: 'Warning contrast' },
      { name: '--cinder-danger-contrast', label: 'Danger contrast' },
      { name: '--cinder-danger-hover', label: 'Danger hover' },
      { name: '--cinder-danger-active', label: 'Danger active' },
    ],
  },
  {
    id: 'charts',
    label: 'Chart Series',
    tokens: [
      { name: '--cinder-chart-series-1', label: 'Series 1' },
      { name: '--cinder-chart-series-2', label: 'Series 2' },
      { name: '--cinder-chart-series-3', label: 'Series 3' },
      { name: '--cinder-chart-series-4', label: 'Series 4' },
      { name: '--cinder-chart-series-5', label: 'Series 5' },
      { name: '--cinder-chart-series-6', label: 'Series 6' },
      { name: '--cinder-chart-series-7', label: 'Series 7' },
      { name: '--cinder-chart-series-8', label: 'Series 8' },
    ],
  },
  {
    id: 'status-triples',
    label: 'Status Surfaces',
    tokens: [
      { name: '--cinder-color-info-bg', label: 'Info background' },
      { name: '--cinder-color-info-fg', label: 'Info foreground' },
      { name: '--cinder-color-info-border', label: 'Info border' },
      { name: '--cinder-color-success-bg', label: 'Success background' },
      { name: '--cinder-color-success-fg', label: 'Success foreground' },
      { name: '--cinder-color-success-border', label: 'Success border' },
      { name: '--cinder-color-warning-bg', label: 'Warning background' },
      { name: '--cinder-color-warning-fg', label: 'Warning foreground' },
      { name: '--cinder-color-warning-border', label: 'Warning border' },
      { name: '--cinder-color-danger-bg', label: 'Danger background' },
      { name: '--cinder-color-danger-fg', label: 'Danger foreground' },
      { name: '--cinder-color-danger-border', label: 'Danger border' },
    ],
  },
  {
    id: 'surfaces',
    label: 'Surfaces',
    tokens: [
      { name: '--cinder-bg', label: 'Page background' },
      { name: '--cinder-surface', label: 'Surface' },
      { name: '--cinder-surface-raised', label: 'Raised surface' },
      { name: '--cinder-surface-inset', label: 'Inset surface' },
      { name: '--cinder-surface-hover', label: 'Surface hover' },
      { name: '--cinder-surface-pressed', label: 'Surface pressed' },
      { name: '--cinder-surface-inverse', label: 'Inverse surface' },
    ],
  },
  {
    id: 'text',
    label: 'Text and Disabled Fill',
    tokens: [
      { name: '--cinder-text', label: 'Text' },
      { name: '--cinder-text-muted', label: 'Muted text' },
      { name: '--cinder-text-subtle', label: 'Subtle text' },
      { name: '--cinder-text-disabled', label: 'Disabled text' },
      { name: '--cinder-fill-disabled', label: 'Disabled fill' },
      { name: '--cinder-text-inverse', label: 'Inverse text' },
    ],
  },
  {
    id: 'borders',
    label: 'Borders',
    tokens: [
      { name: '--cinder-border', label: 'Border' },
      { name: '--cinder-border-muted', label: 'Muted border' },
      { name: '--cinder-border-strong', label: 'Strong border' },
      { name: '--cinder-border-inverse', label: 'Inverse border' },
    ],
  },
  {
    id: 'focus',
    label: 'Focus Ring',
    tokens: [
      { name: '--cinder-ring-offset-color', label: 'Ring offset color' },
      { name: '--cinder-ring-color', label: 'Ring color' },
      { name: '--cinder-ring-on-accent', label: 'Ring on accent' },
    ],
  },
  {
    id: 'overlay',
    label: 'Overlay',
    tokens: [{ name: '--cinder-overlay-backdrop', label: 'Backdrop' }],
  },
  {
    id: 'scrollbars',
    label: 'Scrollbars',
    tokens: [
      { name: '--cinder-scrollbar-track', label: 'Track' },
      { name: '--cinder-scrollbar-thumb', label: 'Thumb' },
      { name: '--cinder-scrollbar-thumb-hover', label: 'Thumb hover' },
    ],
  },
] as const;

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

/** Token names whose value shape (shadows, gradients) means they can never be
 * a themeable solid/translucent color, regardless of what they reference. */
const NON_COLOR_TOKEN_NAME_PATTERN = /shadow|gradient/;

/** Value shapes that mark a `:root` declaration as color-valued: an
 * OKLCH/`color-mix()`/`light-dark()` function call, or the `transparent`
 * keyword. This mirrors the reproduction in issue #770 so the guard's notion
 * of "color-valued" matches the one used to originally audit the drift. */
const COLOR_TOKEN_VALUE_PATTERN = /oklch|color-mix|light-dark|transparent/i;

/**
 * Extracts every `--cinder-*` custom property declared directly in a
 * `:root { ... }` block (see `extractRootBlock` in
 * `@cinder/components/src/test/token-introspection.ts`) whose value shape
 * marks it as color-valued, mapped to its raw declared value.
 */
export function findColorTokenDeclarations(rootBlock: string): Map<string, string> {
  const declarations = new Map<string, string>();

  for (const match of rootBlock.matchAll(/(--cinder-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name === undefined || value === undefined) continue;
    if (NON_COLOR_TOKEN_NAME_PATTERN.test(name)) continue;
    if (!COLOR_TOKEN_VALUE_PATTERN.test(value)) continue;

    declarations.set(name, value.trim());
  }

  return declarations;
}

/**
 * The reverse of `COLOR_TOKEN_NAMES`' own drift guard: every color-valued
 * token declared in `:root` must be either registered in
 * `COLOR_TOKEN_GROUPS` or listed in `optOutTokenNames` as a conscious,
 * commented exclusion. A token in neither set is a silent omission from the
 * playground's color panel and is returned here so the caller can fail loudly.
 */
export function findUnregisteredColorTokens(
  rootBlock: string,
  registeredTokenNames: ReadonlySet<string>,
  optOutTokenNames: ReadonlySet<string>,
): string[] {
  const colorTokenNames = [...findColorTokenDeclarations(rootBlock).keys()];

  return colorTokenNames.filter(
    (name) => !registeredTokenNames.has(name) && !optOutTokenNames.has(name),
  );
}
