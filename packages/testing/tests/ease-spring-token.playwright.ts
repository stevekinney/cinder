/// <reference lib="dom" />
/**
 * Regression test for `--cinder-ease-spring`.
 *
 * The token is referenced by the enter motion on Modal, Drawer, and
 * CommandPalette. When it was missing from tokens-base.css, every reference
 * silently fell back to the browser's default `ease`, so the motion that
 * shipped was not the motion that was designed.
 *
 * Modal's entrance moved from a `@keyframes`/`animation` on `.cinder-modal`
 * to a `transition` + `@starting-style` on `.cinder-modal__panel` (matching
 * Drawer, so the dialog-based overlays share one mechanism and
 * get a real, symmetric exit transition). The token's resolved value is still
 * checked on the dialog element (it cascades down regardless of which element
 * consumes it); the timing-function check now targets the panel's
 * `transition-timing-function`, the property that actually drives the
 * translate motion under the new mechanism.
 *
 * This test opens the basic modal example in the playground and asserts:
 *   1. the resolved value of `--cinder-ease-spring` on the modal element
 *      matches the documented `cubic-bezier(0.22, 1, 0.36, 1)`.
 *   2. the panel's computed `transition-timing-function` includes that same
 *      cubic-bezier — i.e. the `translate` transition successfully resolved
 *      the custom timing curve rather than falling back to the browser
 *      default.
 */

import { expect, test } from '@playwright/test';

const SPRING_CUBIC_BEZIER = 'cubic-bezier(0.22, 1, 0.36, 1)';

test.describe('--cinder-ease-spring token', () => {
  test('resolves on the modal element and drives a non-default timing curve', async ({ page }) => {
    await page.goto('/page/modal?tab=examples', { waitUntil: 'load' });

    // The basic example renders a trigger button that opens a generic modal
    // (an "Invite teammate" form); click it to open the modal.
    await page.getByRole('button', { name: 'Invite teammate' }).first().click();

    const modal = page.locator('.cinder-modal').first();
    await expect(modal).toBeVisible();
    const panel = page.locator('.cinder-modal__panel').first();

    const spring = await modal.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--cinder-ease-spring').trim(),
    );
    const timingFunction = await panel.evaluate(
      (element) => getComputedStyle(element).transitionTimingFunction,
    );

    expect(spring).toBe(SPRING_CUBIC_BEZIER);
    // When the token is undefined the transition falls back to `ease`. The
    // assertion guards against future regressions where the token is defined
    // but not actually reached by the transition cascade.
    expect(timingFunction).toContain(SPRING_CUBIC_BEZIER);
  });
});
