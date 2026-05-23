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
 * The test opens the basic card example, confirms the document advertises
 * the correct `color-scheme` (the prerequisite for `light-dark()` to
 * branch at all), and asserts that `.cinder-card`:
 *   1. Has a non-`none` resolved `box-shadow` in both themes.
 *   2. Resolves to different `box-shadow` strings between light and dark.
 *
 * The "different strings" assertion is the load-bearing one: if
 * `light-dark()` did not branch (because `color-scheme` is misconfigured
 * or the wrapping is wrong) the two computed values would match and the
 * regression is back.
 */

import { expect, test } from '@playwright/test';

async function loadCard(themedPage: import('@playwright/test').Page) {
  await themedPage.goto('/page/card', { waitUntil: 'load' });
  const card = themedPage.locator('.cinder-card').first();
  await expect(card).toBeVisible();
  return card;
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

      const [lightCard, darkCard] = await Promise.all([loadCard(lightPage), loadCard(darkPage)]);

      // `light-dark()` only branches when the document advertises a usable
      // `color-scheme`. If this prerequisite is missing the rest of the
      // test would pass vacuously, so check it explicitly.
      const lightScheme = await lightPage.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      );
      const darkScheme = await darkPage.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      );
      expect(lightScheme).toMatch(/light/);
      expect(darkScheme).toMatch(/dark/);

      const [lightShadow, darkShadow] = await Promise.all([
        lightCard.evaluate((element) => getComputedStyle(element).boxShadow),
        darkCard.evaluate((element) => getComputedStyle(element).boxShadow),
      ]);

      // Both themes must paint a real shadow.
      expect(lightShadow).not.toBe('none');
      expect(darkShadow).not.toBe('none');

      // Light and dark must resolve to different values; otherwise the
      // `light-dark()` wrapping did not take effect and the regression is
      // back. This is the definitive assertion — string-matching on the
      // resolved color is unreliable across browser versions (Chromium
      // 111+ may serialize `oklch()` natively rather than normalizing to
      // `rgb()`), so we trust the inequality and the explicit
      // `color-scheme` check above.
      expect(lightShadow).not.toBe(darkShadow);
    } finally {
      await lightContext.close();
      await darkContext.close();
    }
  });
});
