import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  extractRootBlock,
  readRootTokenNames,
} from '../../../components/src/test/token-introspection.ts';
import {
  COLOR_TOKEN_GROUPS,
  COLOR_TOKEN_NAMES,
  isSafeColorTokenValue,
} from './color-token-registry.ts';

/** Token names whose value shape (shadows, gradients) means they can never be
 * a themeable solid/translucent color, regardless of what they reference. */
const NON_COLOR_TOKEN_NAME_PATTERN = /shadow|gradient/;

/**
 * Value shapes that mark a declaration as directly color-valued.
 *
 * Deliberately covers every syntax `isSafeColorTokenValue` accepts, not just
 * the ones `tokens-base.css` happens to use today: a future token written as
 * `#fff`, `rgb(…)`, `hsl(…)`, `oklab(…)` or `currentcolor` is exactly the kind
 * of edit this guard exists to catch, and a narrower pattern would wave it
 * through. `shadow`/`gradient` names are filtered separately by
 * NON_COLOR_TOKEN_NAME_PATTERN, so the function list below does not need to
 * exclude them.
 */
const DIRECT_COLOR_VALUE_PATTERN =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\s*\(|\b(?:transparent|currentcolor|black|white)\b/i;

/** A value that is nothing but a `var(--cinder-x)` reference, optionally with a
 * fallback. These are invisible to the direct value-shape scan, so they are
 * resolved through their target below. */
const ALIAS_VALUE_PATTERN = /^var\(\s*(--cinder-[a-z0-9-]+)/;

/** Strip CSS comments so a commented-out declaration is never mistaken for a
 * real one — `extractRootBlock` returns the raw `:root` body, comments and all. */
function stripCssComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Every `--cinder-*` custom property declared directly in a `:root { … }` body
 * whose value marks it as color-valued, mapped to its raw declared value.
 *
 * Resolves alias chains: a token declared as `var(--cinder-other)` carries no
 * color function of its own, so a direct value-shape scan would miss it
 * entirely. Following the alias to a directly color-valued token catches the
 * pure-alias color tokens this guard exists to notice. Cycles and aliases that
 * bottom out in a non-color value are simply not treated as colors.
 */
function findColorTokenDeclarations(rootBlock: string): Map<string, string> {
  const allDeclarations = new Map<string, string>();
  for (const match of stripCssComments(rootBlock).matchAll(
    /(--cinder-[a-z0-9-]+)\s*:\s*([^;]+);/g,
  )) {
    const [, name, value] = match;
    if (name === undefined || value === undefined) continue;
    allDeclarations.set(name, value.trim());
  }

  function resolvesToColor(name: string, seen: Set<string>): boolean {
    if (seen.has(name)) return false;
    seen.add(name);

    const value = allDeclarations.get(name);
    if (value === undefined) return false;
    if (DIRECT_COLOR_VALUE_PATTERN.test(value)) return true;

    const alias = ALIAS_VALUE_PATTERN.exec(value)?.[1];
    return alias === undefined ? false : resolvesToColor(alias, seen);
  }

  const colorDeclarations = new Map<string, string>();
  for (const [name, value] of allDeclarations) {
    if (NON_COLOR_TOKEN_NAME_PATTERN.test(name)) continue;
    if (!resolvesToColor(name, new Set())) continue;
    colorDeclarations.set(name, value);
  }

  return colorDeclarations;
}

/**
 * The reverse of `COLOR_TOKEN_NAMES`' own drift guard: every color-valued token
 * declared in `:root` must be either registered in `COLOR_TOKEN_GROUPS` or
 * listed in `optOutTokenNames` as a conscious, commented exclusion. A token in
 * neither set is a silent omission from the playground's color panel.
 */
function findUnregisteredColorTokens(
  rootBlock: string,
  registeredTokenNames: ReadonlySet<string>,
  optOutTokenNames: ReadonlySet<string>,
): string[] {
  return [...findColorTokenDeclarations(rootBlock).keys()].filter(
    (name) => !registeredTokenNames.has(name) && !optOutTokenNames.has(name),
  );
}

/**
 * Color-valued tokens declared in `tokens-base.css`'s `:root` block that are
 * deliberately NOT exposed in the playground's color panel. Each entry is a
 * conscious exclusion, not a dumping ground — see the inline justification.
 * `color-token-registry.test.ts` asserts every entry here is still a real
 * color-token candidate (so this list can't rot into stale/typo'd names) and
 * that it never overlaps `COLOR_TOKEN_NAMES` (so a token isn't simultaneously
 * registered and "opted out").
 */
const INTENTIONALLY_UNREGISTERED_COLOR_TOKENS = new Set([
  // Calendar-specific derived surface (the "upcoming" day marker), not a
  // general theme role — same class as the toggle-track tokens below.
  '--cinder-surface-upcoming-marker',
  // Component-internal toggle-switch track fill. Mirrors the exclusion of
  // --cinder-button-bg/-fg below: derived, component-scoped, not a general
  // theme role a user would tweak from the color panel.
  '--cinder-toggle-track-off-resting',
  '--cinder-toggle-track-off-hover-resting',
  // Backs the alpha checkerboard swatch backdrop, not a themeable color.
  '--cinder-color-checker-base',
  '--cinder-color-checker-tile',
  // Component-scoped like --cinder-button-bg/-fg (already asserted excluded
  // below): it happens to be the one button-* token with a literal
  // light-dark() value instead of a var() alias, which is why it's the only
  // one of the three caught by the color-value-shape scan in the first place.
  '--cinder-button-border',
  // Component-scoped button surface/foreground. Pure `var()` aliases, so the
  // direct value-shape scan never saw them — only alias resolution surfaces
  // them, and they belong with --cinder-button-border above.
  '--cinder-button-bg',
  '--cinder-button-fg',
]);

const TOKENS_BASE_PATH = join(
  import.meta.dir,
  '..',
  '..',
  '..',
  'components',
  'src',
  'styles',
  'tokens-base.css',
);

describe('color token registry', () => {
  test('contains the expected global color-token inventory', () => {
    expect(COLOR_TOKEN_NAMES).toHaveLength(61);
    expect(COLOR_TOKEN_GROUPS.map((group) => group.id)).toEqual([
      'accent',
      'status-solid',
      'charts',
      'status-triples',
      'surfaces',
      'text',
      'borders',
      'focus',
      'overlay',
      'scrollbars',
    ]);
  });

  test('every registered token is declared in tokens-base.css', async () => {
    const css = await readFile(TOKENS_BASE_PATH, 'utf8');
    const rootTokenNames = readRootTokenNames(css);

    const missing = COLOR_TOKEN_NAMES.filter((tokenName) => !rootTokenNames.has(tokenName));

    expect(missing).toEqual([]);
  });

  test('every color token in tokens-base.css is registered or explicitly excluded', async () => {
    const css = await readFile(TOKENS_BASE_PATH, 'utf8');
    const rootBlock = extractRootBlock(css);
    const registeredTokenNames: ReadonlySet<string> = new Set(COLOR_TOKEN_NAMES);

    // The opt-out list itself must stay honest: no entry may double as a
    // registered token, and every entry must still be a real color-token
    // candidate in :root (otherwise a stale or typo'd entry silently stops
    // excluding anything).
    const registeredAndOptedOut = [...INTENTIONALLY_UNREGISTERED_COLOR_TOKENS].filter((name) =>
      registeredTokenNames.has(name),
    );
    expect(registeredAndOptedOut).toEqual([]);

    const colorTokenDeclarations = findColorTokenDeclarations(rootBlock);
    const staleOptOuts = [...INTENTIONALLY_UNREGISTERED_COLOR_TOKENS].filter(
      (name) => !colorTokenDeclarations.has(name),
    );
    expect(staleOptOuts).toEqual([]);

    const unregistered = findUnregisteredColorTokens(
      rootBlock,
      registeredTokenNames,
      INTENTIONALLY_UNREGISTERED_COLOR_TOKENS,
    );
    expect(unregistered).toEqual([]);
  });

  test('findUnregisteredColorTokens fails loudly on a new, unregistered color token', () => {
    const rootBlock = `
      --cinder-accent: oklch(72% 0.14 270);
      --cinder-shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.1);
      --cinder-space-4: 1rem;
      --cinder-test-new-token: light-dark(oklch(50% 0.1 200), oklch(60% 0.1 200));
    `;
    const registeredTokenNames = new Set(['--cinder-accent']);
    const optOutTokenNames = new Set<string>();

    const unregistered = findUnregisteredColorTokens(
      rootBlock,
      registeredTokenNames,
      optOutTokenNames,
    );

    expect(unregistered).toEqual(['--cinder-test-new-token']);
  });

  test('excludes non-color and non-global token namespaces', () => {
    expect(COLOR_TOKEN_NAMES).not.toContain('--cinder-shadow-sm');
    expect(COLOR_TOKEN_NAMES).not.toContain('--cinder-space-4');
    expect(COLOR_TOKEN_NAMES).not.toContain('--cinder-text-sm');
    expect(COLOR_TOKEN_NAMES).not.toContain('--cinder-z-modal');
    expect(COLOR_TOKEN_NAMES).not.toContain('--cinder-overlay-padding');
    expect(COLOR_TOKEN_NAMES).not.toContain('--cinder-scrollbar-size');
    expect(COLOR_TOKEN_NAMES).not.toContain('--cinder-button-bg');
    expect(COLOR_TOKEN_NAMES.some((tokenName) => tokenName.startsWith('--_cinder-'))).toBe(false);
  });

  test('fallback color validation requires full value matches', () => {
    const originalCss = globalThis.CSS;
    Object.defineProperty(globalThis, 'CSS', {
      configurable: true,
      value: undefined,
      writable: true,
    });

    try {
      expect(isSafeColorTokenValue('rgb(1 2 3)')).toBe(true);
      expect(isSafeColorTokenValue('var(--cinder-accent)')).toBe(true);
      expect(isSafeColorTokenValue('transparent')).toBe(true);
      expect(isSafeColorTokenValue('rgb(')).toBe(false);
      expect(isSafeColorTokenValue('rgb(1 2 3)junk')).toBe(false);
      expect(isSafeColorTokenValue('var(--cinder-accent)junk')).toBe(false);
      expect(isSafeColorTokenValue('transparent-junk')).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'CSS', {
        configurable: true,
        value: originalCss,
        writable: true,
      });
    }
  });

  test('CSS.supports path still enforces the playground color allowlist', () => {
    const originalCss = globalThis.CSS;
    Object.defineProperty(globalThis, 'CSS', {
      configurable: true,
      value: {
        supports: () => true,
      },
      writable: true,
    });

    try {
      expect(isSafeColorTokenValue('rgb(1 2 3)')).toBe(true);
      expect(isSafeColorTokenValue('var(--cinder-accent)')).toBe(true);
      expect(isSafeColorTokenValue('color-mix(in oklch, var(--cinder-accent), white)')).toBe(true);
      expect(isSafeColorTokenValue('var(--anything)')).toBe(false);
      expect(isSafeColorTokenValue('color-mix(in oklch, var(--anything), white)')).toBe(false);
      expect(isSafeColorTokenValue('rebeccapurple')).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'CSS', {
        configurable: true,
        value: originalCss,
        writable: true,
      });
    }
  });
});
