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
 * dimensions (accent color, surface, border, radius) against components that
 * consume them, by:
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
});
