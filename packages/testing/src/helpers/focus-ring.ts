/// <reference lib="dom" />
/**
 * Shared utilities for the focus-ring Playwright specs. Rendered focus/error
 * rings can only be proven with a REAL browser (happy-dom does not compute
 * `box-shadow`/`border-color`) and a REAL keyboard (a programmatic `.focus()`
 * does not engage `:focus-visible` in Chromium), so these helpers drive the
 * keyboard, resolve design tokens through the engine, and read computed style.
 *
 * This is the canonical home for the keyboard-walk idiom; `*-focus-rings`
 * specs should import from here rather than re-declaring it.
 */

import type { Locator, Page } from '@playwright/test';

/**
 * Walk Tab from `document.body` until `target` is the active element, capped at
 * `maxPresses`. Returns true when focus landed on the target. Blurs first so the
 * walk is deterministic regardless of any prior autofocus.
 */
export async function tabUntilFocused(
  page: Page,
  target: Locator,
  maxPresses = 50,
): Promise<boolean> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.focus();
  });
  for (let attempt = 0; attempt < maxPresses; attempt += 1) {
    await page.keyboard.press('Tab');
    const landed = await target.evaluate((element) => element === document.activeElement);
    if (landed) return true;
  }
  return false;
}

/**
 * Resolve a CSS custom property on `element` to a browser-normalized color
 * string by painting the token onto a probe span and reading its computed
 * color. Lets a test match the resolved token against a `box-shadow` value
 * without hard-coding the engine's serialization (rgb/oklch/etc).
 */
export async function resolvedTokenColor(target: Locator, token: string): Promise<string> {
  return target.evaluate((element, tokenName) => {
    const value = getComputedStyle(element as HTMLElement)
      .getPropertyValue(tokenName)
      .trim();
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.append(probe);
    try {
      return getComputedStyle(probe).color;
    } finally {
      probe.remove();
    }
  }, token);
}

/** Count comma-separated top-level box-shadow layers (commas inside fn args ignored). */
export function boxShadowLayerCount(boxShadow: string): number {
  return boxShadow.split(/,(?![^(]*\))/).length;
}
