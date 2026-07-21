import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { readRootTokenNames } from '../../../components/src/test/token-introspection.ts';
import {
  COLOR_TOKEN_GROUPS,
  COLOR_TOKEN_NAMES,
  isSafeColorTokenValue,
} from './color-token-registry.ts';

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
    expect(COLOR_TOKEN_NAMES).toHaveLength(56);
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
