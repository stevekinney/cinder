/**
 * Regression test for `--cinder-ease-spring`.
 *
 * The token is referenced by the enter animations on Modal, Drawer, Sheet, and
 * CommandPalette. When it was missing from tokens-base.css, every reference
 * silently fell back to the browser's default `ease`, so the motion that
 * shipped was not the motion that was designed.
 *
 * This test opens the basic modal example in the playground and asserts:
 *   1. the resolved value of `--cinder-ease-spring` on the modal element
 *      matches the documented `cubic-bezier(0.34, 1.56, 0.64, 1)`.
 *   2. the computed `animation-timing-function` is not `ease` — i.e. the
 *      animation declaration successfully resolved a custom timing curve
 *      rather than falling back to the browser default.
 */

import { expect, test } from '@playwright/test';

const SPRING_CUBIC_BEZIER = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

test.describe('--cinder-ease-spring token', () => {
  test('resolves on the modal element and drives a non-default timing curve', async ({ page }) => {
    await page.goto('/page/modal', { waitUntil: 'load' });

    // The basic example renders a trigger button labelled "Open modal".
    await page.getByRole('button', { name: 'Open modal' }).first().click();

    const modal = page.locator('.cinder-modal').first();
    await expect(modal).toBeVisible();

    const { spring, timingFunction } = await modal.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        spring: styles.getPropertyValue('--cinder-ease-spring').trim(),
        timingFunction: styles.animationTimingFunction,
      };
    });

    expect(spring).toBe(SPRING_CUBIC_BEZIER);
    // When the token is undefined the animation falls back to `ease`. The
    // assertion guards against future regressions where the token is defined
    // but not actually reached by the animation cascade.
    expect(timingFunction).not.toBe('ease');
  });
});
