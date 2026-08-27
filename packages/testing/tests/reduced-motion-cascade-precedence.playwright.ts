/// <reference lib="dom" />
/**
 * CIN-468: proves the CASCADE precedence between the two reduced-motion CSS
 * blocks tokens-base.css emits — not just their generated text, which
 * tokens.test.ts already pins.
 *
 * The generator (packages/components/scripts/tokens/generate.ts) emits two
 * blocks: an `@media (prefers-reduced-motion: reduce)` block selecting
 * `:root:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on'])`,
 * and an explicit `:root[data-reduced-motion='on']` override. Before the
 * fix, the media selector excluded `'off'` but not `'on'`, so when the OS
 * preferred reduced motion AND `data-reduced-motion="on"` was set
 * explicitly, BOTH blocks matched and the media block won on specificity —
 * discarding the user's explicit override. A unit test on the generated CSS
 * TEXT cannot prove which block a real browser applies when both match; only
 * a page with `prefers-reduced-motion: reduce` actually emulated (this file
 * runs under the `chromium-reduced-motion` Playwright project — see
 * `playwright.config.ts`) and `getComputedStyle` can.
 *
 * The real corpus's `reduced` and `forced-reduced-motion` motion contexts are
 * byte-identical by design (see `generate.ts`'s A1 fixture in
 * `generate.test.ts` for the same reasoning) — precisely why this bug was
 * silent in the shipped app. Proving precedence therefore requires a
 * TEST-ONLY fixture corpus, built the same way `generate.test.ts`'s A1
 * fixture is, whose `reduced` and `forced-reduced-motion` contexts hold
 * genuinely different values. That fixture is run through the real
 * `buildTokensBaseCss` generator to produce a small stylesheet, which is
 * injected into a blank page before asserting computed style — the same
 * "assert the actual computed style" discipline as
 * `ease-spring-token.playwright.ts`.
 */

import { expect, test } from '@playwright/test';

import { buildTokensBaseCss } from '../../components/scripts/tokens/generate.ts';
import type { ResolverDocument, TokenDocument } from '../../components/scripts/tokens/types.ts';

const TEST_PROPERTY = '--test-reduced-motion-duration';

/** Builds a fixture corpus whose `reduced` and `forced-reduced-motion` contexts disagree. */
async function buildFixtureCss(): Promise<string> {
  const baseDocument: TokenDocument = {
    duration: {
      $type: 'duration',
      cascade: {
        $value: { value: 5, unit: 'ms' },
        $extensions: { 'com.lostgradient.cinder': { cssProperty: TEST_PROPERTY } },
      },
    },
  };
  const themeDocument: TokenDocument = {};
  const motionDefaultDocument: TokenDocument = {};
  // Deliberately DIFFERENT values -- the real corpus's two motion documents
  // happen to agree today, which is exactly why the cascade bug this test
  // guards against was invisible against the real app.
  const motionReducedDocument: TokenDocument = {
    duration: { $type: 'duration', cascade: { $value: { value: 1, unit: 'ms' } } },
  };
  const motionForcedDocument: TokenDocument = {
    duration: { $type: 'duration', cascade: { $value: { value: 2, unit: 'ms' } } },
  };

  const resolver: ResolverDocument = {
    version: '2025.10',
    sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
    modifiers: {
      theme: {
        contexts: {
          light: [{ $ref: 'theme-light.json' }],
          dark: [{ $ref: 'theme-dark.json' }],
        },
        default: 'light',
      },
      motion: {
        contexts: {
          default: [{ $ref: 'motion-default.json' }],
          reduced: [{ $ref: 'motion-reduced.json' }],
          'forced-reduced-motion': [{ $ref: 'motion-forced.json' }],
        },
        default: 'default',
      },
    },
    resolutionOrder: [
      { $ref: '#/sets/foundation' },
      { $ref: '#/modifiers/theme' },
      { $ref: '#/modifiers/motion' },
    ],
  };

  const documentsByPath = new Map<string, TokenDocument>([
    ['base.json', baseDocument],
    ['theme-light.json', themeDocument],
    ['theme-dark.json', themeDocument],
    ['motion-default.json', motionDefaultDocument],
    ['motion-reduced.json', motionReducedDocument],
    ['motion-forced.json', motionForcedDocument],
  ]);

  return buildTokensBaseCss(resolver, documentsByPath);
}

/** Reads `TEST_PROPERTY`'s resolved value off `:root`, normalised to milliseconds. */
async function rootDurationMs(page: import('@playwright/test').Page): Promise<number> {
  const raw = await page.evaluate(
    (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    TEST_PROPERTY,
  );
  const amount = Number.parseFloat(raw);
  return raw.endsWith('ms') ? amount : amount * 1000;
}

test.describe('reduced-motion block cascade precedence', () => {
  test('the explicit data-reduced-motion="on" override wins over the media block when both match', async ({
    page,
  }) => {
    const css = await buildFixtureCss();

    await page.goto('about:blank');
    await page.addStyleTag({ content: css });

    // This test runs under the `chromium-reduced-motion` project, so
    // `prefers-reduced-motion: reduce` is emulated for the whole context --
    // the media block's condition is satisfied for every assertion below.

    // No attribute at all: only the media block's selector can match.
    // Its `reduced` context value (1ms) applies.
    expect(await rootDurationMs(page)).toBe(1);

    // The bug: with the OS preferring reduced motion AND the explicit
    // override set to 'on', the OLD media selector (missing
    // `:not([data-reduced-motion='on'])`) still matched, and its (0,3,0)
    // specificity beat the explicit block's (0,2,0) -- so the media block's
    // `reduced` value (1ms) won instead of the user's explicit
    // `forced-reduced-motion` override (2ms). The fix makes the two blocks
    // mutually exclusive so the explicit override always wins.
    await page.evaluate(() => document.documentElement.setAttribute('data-reduced-motion', 'on'));
    expect(await rootDurationMs(page)).toBe(2);

    // The existing opt-out must keep working: 'off' excludes the media block
    // too, and there is no 'off'-specific block, so this falls back to the
    // base value (5ms) -- neither reduced-motion block applies.
    await page.evaluate(() => document.documentElement.setAttribute('data-reduced-motion', 'off'));
    expect(await rootDurationMs(page)).toBe(5);

    // Removing the attribute returns to the media-block-only state.
    await page.evaluate(() => document.documentElement.removeAttribute('data-reduced-motion'));
    expect(await rootDurationMs(page)).toBe(1);
  });
});
