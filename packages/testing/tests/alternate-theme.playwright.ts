/// <reference lib="dom" />
/**
 * Themeability regression fixture for the documented design-token contract.
 *
 * The themeability promise (task 2f6e14c8) is that a consumer can override a
 * small, documented set of `--cinder-*` design tokens and the whole component
 * library follows — no component leaks a hard-coded color, radius, or other
 * value that the token override cannot reach.
 *
 * This test proves the contract end-to-end for a representative spread of token
 * dimensions (accent color, surface, border, radius, status color, focus ring,
 * spacing) against components that consume them, by:
 *   1. Loading a real component page from the playground.
 *   2. Recording the component's computed style with the stock tokens.
 *   3. Injecting an alternate theme that overrides ONLY documented `:root`
 *      tokens to deliberately distinct values.
 *   4. Asserting the component's computed style now reflects the override.
 *
 * The load-bearing assertion is the inequality between stock and themed values:
 * if a component hard-codes a color instead of consuming the token, the override
 * has no effect and the two values match — that is the leak this fixture catches.
 * The companion `tokens:audit` / `colors:audit` guards catch leaks statically;
 * this fixture catches the ones that only manifest at paint time.
 */

import { expect, test, type Page } from '@playwright/test';

/**
 * The alternate theme: documented `:root` tokens overridden to values that are
 * unmistakably distinct from the stock theme, so a component that genuinely
 * consumes the token resolves to the override and a hard-coded leak does not.
 * Every name here MUST be a documented global token in `tokens-base.css`.
 */
const ALTERNATE_THEME = `
  :root {
    --cinder-accent: oklch(62% 0.22 25);
    --cinder-accent-contrast: oklch(98% 0 0);
    --cinder-surface: oklch(95% 0.03 280);
    --cinder-border: oklch(60% 0.15 300);
    --cinder-radius-lg: 1.25rem;
    --cinder-danger: oklch(55% 0.20 145);
    --cinder-ring-color: oklch(70% 0.25 145);
    --cinder-ring-width: 8px;
    --cinder-space-4: 2.5rem;
  }
`;

async function computed(page: Page, selector: string, property: string): Promise<string> {
  const element = page.locator(selector).first();
  await expect(element).toBeVisible();
  return element.evaluate(
    (node, prop) => getComputedStyle(node as Element).getPropertyValue(prop),
    property,
  );
}

test.describe('alternate-theme — documented token overrides reach components', () => {
  test('overriding --cinder-accent reaches a primary Button background', async ({ page }) => {
    await page.goto('/page/button', { waitUntil: 'load' });

    const primarySelector = ".cinder-button[data-cinder-variant='primary']";
    const stock = await computed(page, primarySelector, 'background-color');

    await page.addStyleTag({ content: ALTERNATE_THEME });

    const themed = await computed(page, primarySelector, 'background-color');

    // The accent override must change the primary background. Equal values mean
    // the button hard-codes its accent instead of consuming `--cinder-accent`.
    expect(themed).not.toBe(stock);
  });

  test('overriding --cinder-radius-lg reaches a Card border-radius', async ({ page }) => {
    await page.goto('/page/card', { waitUntil: 'load' });

    const cardSelector = '.cinder-card';
    const stock = await computed(page, cardSelector, 'border-top-left-radius');

    await page.addStyleTag({ content: ALTERNATE_THEME });

    const themed = await computed(page, cardSelector, 'border-top-left-radius');

    // If the card hard-codes its radius the override is inert and these match.
    expect(themed).not.toBe(stock);
  });

  // (a) --cinder-surface reaches a surface component's background-color.
  // The Surface component's base rule is `background: var(--cinder-surface)`.
  // A hard-coded background on .cinder-surface would leave these values equal.
  test('overriding --cinder-surface reaches a Surface component background', async ({ page }) => {
    await page.goto('/page/surface', { waitUntil: 'load' });

    const surfaceSelector = '.cinder-surface';
    const stock = await computed(page, surfaceSelector, 'background-color');

    await page.addStyleTag({ content: ALTERNATE_THEME });

    const themed = await computed(page, surfaceSelector, 'background-color');

    // The surface token must drive the computed background. A hard-coded value
    // would survive the override unchanged.
    expect(themed).not.toBe(stock);
  });

  // (b) --cinder-border reaches a bordered component's border-color.
  // Input CSS: `border: 1px solid var(--cinder-border)`.
  // A hard-coded border-color on .cinder-input would leave these equal.
  test('overriding --cinder-border reaches an Input border-color', async ({ page }) => {
    await page.goto('/page/input', { waitUntil: 'load' });

    const inputSelector = '.cinder-input';
    const stock = await computed(page, inputSelector, 'border-top-color');

    await page.addStyleTag({ content: ALTERNATE_THEME });

    const themed = await computed(page, inputSelector, 'border-top-color');

    // Equal means the input hard-codes its border instead of consuming
    // --cinder-border, a real theming leak.
    expect(themed).not.toBe(stock);
  });

  // (c) --cinder-danger reaches an Alert "error" variant's background.
  //
  // Alert[variant=error] sets `--_cinder-status-base: var(--cinder-danger)` which
  // feeds the _status-surface recipe's `oklch(from var(--_cinder-status-base) ...)`.
  // Overriding --cinder-danger to a different hue changes the synthesized background.
  //
  // Note: Alert composes `.cinder-_status-surface` only (not the border class per P7),
  // so background-color is the most reliable property to assert on.
  test('overriding --cinder-danger reaches an Alert error-variant background', async ({ page }) => {
    await page.goto('/page/alert', { waitUntil: 'load' });

    const errorAlertSelector = ".cinder-alert[data-cinder-variant='error']";
    const stock = await computed(page, errorAlertSelector, 'background-color');

    await page.addStyleTag({ content: ALTERNATE_THEME });

    const themed = await computed(page, errorAlertSelector, 'background-color');

    // The danger token drives the status-surface recipe's hue. A hard-coded
    // background or a broken token chain leaves these equal.
    expect(themed).not.toBe(stock);
  });

  // (d) --cinder-ring-width reaches a focused element's outline-width.
  //
  // The button's :focus-visible rule sets:
  //   outline: var(--cinder-ring-width) solid transparent;
  //
  // Overriding --cinder-ring-width from 3px to 8px must change the resolved
  // `outline-width` on the focused element.
  //
  // We assert on `outline-width` rather than `box-shadow` because the box-shadow
  // color arms use `light-dark(oklch(from ...) ...)` relative-color syntax which
  // resolves to `oklab(0 0 0 / 0)` in Playwright's Chromium (the browser-internal
  // color-scheme context differs from a real page). The outline assertion avoids
  // that serialization ambiguity while still proving the ring-width token flows.
  //
  // :focus-visible only activates for KEYBOARD focus in Chromium — programmatic
  // locator.focus() does NOT set it on a <button>, so the outline rule would never
  // apply and the test would compare two `0px` values (a vacuous pass). We therefore
  // drive focus with Tab. To keep the Tab walk from silently never reaching the
  // target (the brittleness of a bare iteration cap), `focusPrimaryButton` returns
  // whether it landed AND we assert it did, and we assert :focus-visible is actually
  // active before reading outline-width — so any failure to reach a keyboard-focused
  // button fails loudly instead of passing vacuously.
  async function focusPrimaryButton(page: Page): Promise<void> {
    const primaryHasFocusVisible = () =>
      page.evaluate(() => {
        const active = document.activeElement;
        return (
          active instanceof HTMLElement &&
          active.matches(".cinder-button[data-cinder-variant='primary']") &&
          active.matches(':focus-visible')
        );
      });

    for (let tabIndex = 0; tabIndex < 50; tabIndex++) {
      await page.keyboard.press('Tab');
      if (await primaryHasFocusVisible()) return;
    }
    throw new Error('Tab walk never reached a keyboard-focused primary button');
  }

  test('overriding --cinder-ring-width reaches a focused Button outline-width', async ({
    page,
  }) => {
    await page.goto('/page/button', { waitUntil: 'load' });

    await focusPrimaryButton(page);
    const stock = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineWidth);

    await page.addStyleTag({ content: ALTERNATE_THEME });

    // Re-acquire keyboard focus after injection (start over from the top of the
    // tab order so the walk is deterministic).
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await focusPrimaryButton(page);
    const themed = await page.evaluate(
      () => getComputedStyle(document.activeElement!).outlineWidth,
    );

    // The ring-width token must change the focused button's outline-width.
    // Stock: 3px; alternate: 8px. Equal values mean the button hard-codes its ring.
    expect(themed).not.toBe(stock);
  });

  // (e) --cinder-space-4 reaches a Card body's padding.
  //
  // Card CSS: `.cinder-card__body { padding: var(--cinder-space-4); }`
  // Stock value: 1rem (16px). Alternate theme: 2.5rem (40px).
  // A hard-coded padding would not change, leaving these equal.
  test('overriding --cinder-space-4 reaches a Card body padding', async ({ page }) => {
    await page.goto('/page/card', { waitUntil: 'load' });

    const bodySelector = '.cinder-card__body';
    const stock = await computed(page, bodySelector, 'padding-top');

    await page.addStyleTag({ content: ALTERNATE_THEME });

    const themed = await computed(page, bodySelector, 'padding-top');

    // Equal values mean the card body hard-codes its padding instead of consuming
    // --cinder-space-4 — a real spacing-token leak.
    expect(themed).not.toBe(stock);
  });
});
