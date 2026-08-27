/// <reference lib="dom" />
/**
 * CIN-34: proof that the GENERATED token CSS is what actually paints.
 *
 * Every other guard in the token pipeline compares one generated artifact to
 * another — the corpus to the registry, the registry to `tokens-base.css`, the
 * resolved contexts to the corpus. All of them would still pass if the
 * stylesheet never reached the browser, or reached it and lost to something
 * else. These three tests close that gap by reading computed style off a real
 * page: a reduced-motion token zeroing a real component's transition, a token
 * override staying scoped to the component it was set on, and theme reach
 * extending past color to a dimension token.
 *
 * All three use the PLAIN documentation page, never `?snapshot=1`.
 * `snapshot-mode.ts` freezes motion with `transition-duration: 0s !important`
 * so screenshots are stable, which makes a snapshot page structurally unable to
 * show that a duration token changed anything. `overlay-reduced-motion-exit`
 * avoids `?snapshot=1` for the same reason.
 *
 * Reduced motion is emulated per-test with `page.emulateMedia` rather than by
 * the `chromium-reduced-motion` project in `playwright.config.ts`, which is
 * `testMatch`-scoped to one other file and sets the preference for a whole
 * context. This test has to observe BOTH states to show the token changed
 * anything, and a context-level preference cannot be flipped mid-test.
 */

import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;
type Locator = import('@playwright/test').Locator;

/** Read one resolved custom property off `:root`. */
async function rootToken(page: Page, property: string): Promise<string> {
  return page.evaluate(
    (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    property,
  );
}

/**
 * A CSS time value in seconds.
 *
 * The corpus authors durations in `ms`, but a registered custom property's
 * COMPUTED value is normalised — `0ms` is reported as `0s` — so comparing the
 * literal text would pin a serialization detail rather than the value.
 */
function timeToSeconds(value: string): number {
  const trimmed = value.trim();
  const amount = Number.parseFloat(trimmed);
  return trimmed.endsWith('ms') ? amount / 1000 : amount;
}

/** Longest `transition-duration` component, in seconds. */
async function longestTransitionSeconds(locator: Locator): Promise<number> {
  const raw = await locator.evaluate((element) => getComputedStyle(element).transitionDuration);
  const parts = raw.split(',').map((part) => Number.parseFloat(part.trim()));
  return Math.max(...parts);
}

async function borderColor(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).borderTopColor);
}

test.describe('generated token CSS drives visible styles', () => {
  test('reduced motion zeroes both the duration token and a Button transition', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/page/button', { waitUntil: 'load' });

    const button = page.locator('.cinder-button').first();
    await expect(button).toBeVisible();

    /*
     * Precondition the rest of the test rests on: the component has to be
     * animating in the first place. A component that never had a transition
     * would satisfy the reduced-motion assertion trivially.
     */
    expect(timeToSeconds(await rootToken(page, '--cinder-duration-fast'))).toBeCloseTo(0.12, 5);
    expect(await longestTransitionSeconds(button)).toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: 'reduce' });

    /*
     * Two independent mechanisms have to hold, and they are worth asserting
     * separately because either could regress alone:
     *
     *   - the generated token itself flips to `0ms`, from the
     *     `@media (prefers-reduced-motion: reduce)` block in `tokens-base.css`;
     *   - what the component actually paints collapses to effectively nothing.
     *
     * The painted value is compared numerically rather than against a literal:
     * `foundation.css` wins the cascade here with `0.01ms !important`, which the
     * browser reports as `1e-05s`. Asserting that exact string would pin a
     * serialization detail; asserting "under a millisecond" pins the behaviour.
     */
    await expect
      .poll(async () => timeToSeconds(await rootToken(page, '--cinder-duration-fast')))
      .toBe(0);
    expect(await longestTransitionSeconds(button)).toBeLessThan(0.001);
  });

  test('a token override scoped to one component does not leak to another', async ({ page }) => {
    await page.goto('/page/card', { waitUntil: 'load' });

    /*
     * Card and Accordion are unrelated components that both read
     * `--cinder-border` for their border color, and both appear on this page in
     * separate subtrees — which is what makes a scoped override's
     * non-leakage observable.
     */
    const card = page.locator('.cinder-card').first();
    const accordion = page.locator('.cinder-accordion').first();
    await expect(card).toBeVisible();
    await expect(accordion).toBeVisible();

    const cardBefore = await borderColor(card);
    const accordionBefore = await borderColor(accordion);

    /*
     * Load-bearing precondition: they must START equal. If the two components
     * did not actually share the token, the "unaffected" assertion below would
     * hold for a completely uninteresting reason and prove nothing about
     * leakage.
     */
    expect(cardBefore).toBe(accordionBefore);

    const override = 'rgb(255, 0, 255)';
    await card.evaluate((element, value) => {
      element.style.setProperty('--cinder-border', value);
    }, override);

    await expect.poll(async () => borderColor(card)).toBe(override);
    expect(await borderColor(accordion)).toBe(accordionBefore);
  });

  test('theme reach extends past color to a dimension token', async ({ page }) => {
    await page.goto('/page/card', { waitUntil: 'load' });

    const card = page.locator('.cinder-card').first();
    await expect(card).toBeVisible();

    const radiusOf = async (): Promise<string> =>
      card.evaluate((element) => getComputedStyle(element).borderTopLeftRadius);

    expect(await rootToken(page, '--cinder-radius-lg')).not.toBe('');

    const before = await radiusOf();
    expect(before).not.toBe('0px');

    /*
     * The existing playground-panel tests only ever override COLOR tokens,
     * because the colour panel is the only override UI and it carries colours
     * exclusively. Reach past colour therefore has to be exercised by setting
     * the custom property directly — the mechanism a consumer theming Cinder
     * uses anyway.
     */
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--cinder-radius-lg', '2px');
    });

    await expect.poll(radiusOf).toBe('2px');
    expect(before).not.toBe('2px');
  });
});
