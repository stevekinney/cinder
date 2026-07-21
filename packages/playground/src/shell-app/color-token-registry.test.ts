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
  findColorTokenDeclarations,
  findUnregisteredColorTokens,
  isSafeColorTokenValue,
} from './color-token-registry.ts';

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

    const colorTokenNames = findColorTokenDeclarations(rootBlock);
    const staleOptOuts = [...INTENTIONALLY_UNREGISTERED_COLOR_TOKENS].filter(
      (name) => !colorTokenNames.has(name),
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
