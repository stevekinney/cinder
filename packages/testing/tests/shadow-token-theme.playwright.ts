/// <reference lib="dom" />
/**
 * Regression test for the `--cinder-shadow-*` token family.
 *
 * The shadow tokens used to be defined with black-only OKLCH alphas
 * (`oklch(0% 0 0 / α)`). In dark mode, painting black-on-dark hides the
 * elevation entirely — cards on dark surfaces lose their lift.
 *
 * The fix wraps each shadow color in `light-dark(light-color, dark-color)`
 * so the dark-mode variant uses a light-neutral OKLCH alpha that is
 * actually visible against the dark surface tokens.
 *
 * This test opens the basic card example in the playground and asserts
 * that `.cinder-card`:
 *   1. Has a non-`none` resolved `box-shadow` in light mode.
 *   2. Has a non-`none` resolved `box-shadow` in dark mode.
 *   3. Resolves to different `box-shadow` strings between light and dark.
 *   4. The dark-mode resolved color does not match the legacy black-only
 *      pattern (`rgba(0, 0, 0, *)` / `rgb(0, 0, 0)`).
 */

import { expect, test } from '@playwright/test';

async function readCardBoxShadow(themedPage: import('@playwright/test').Page) {
  await themedPage.goto('/page/card', { waitUntil: 'load' });
  const card = themedPage.locator('.cinder-card').first();
  await expect(card).toBeVisible();
  return card.evaluate((element) => getComputedStyle(element).boxShadow);
}

test.describe('--cinder-shadow-* tokens', () => {
  test('resolve to visible, distinct shadows in light vs dark mode', async ({ browser }) => {
    const lightContext = await browser.newContext({
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const darkContext = await browser.newContext({
      colorScheme: 'dark',
      reducedMotion: 'reduce',
    });

    try {
      const lightPage = await lightContext.newPage();
      const darkPage = await darkContext.newPage();

      const lightShadow = await readCardBoxShadow(lightPage);
      const darkShadow = await readCardBoxShadow(darkPage);

      // Both themes must paint a real shadow.
      expect(lightShadow).not.toBe('none');
      expect(darkShadow).not.toBe('none');

      // Light and dark must resolve to different values; otherwise the
      // `light-dark()` wrapping did not take effect.
      expect(lightShadow).not.toBe(darkShadow);

      // Browsers normalize OKLCH to either `rgb()` or `rgba()`. The legacy
      // bug was a black-only alpha — `rgba(0, 0, 0, α)` (or `rgb(0, 0, 0)`).
      // Dark mode must not match that pattern.
      const blackOnlyPattern = /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]/i;
      expect(darkShadow).not.toMatch(blackOnlyPattern);

      // Light mode should preserve the original black-family color values.
      expect(lightShadow).toMatch(blackOnlyPattern);
    } finally {
      await lightContext.close();
      await darkContext.close();
    }
  });
});
