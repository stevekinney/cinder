/// <reference lib="dom" />
/**
 * Visual regression for SideNavigation focus-ring clipping and bleed in grouped
 * navigation (ticket 649944d1).
 *
 * The group trigger and every vertical nav item are `inline-size: 100%` and
 * full-bleed to the SideNavigation container edges. With the previous OUTSET
 * ring (`var(--_cinder-focus-ring-shadow)` — offset 1px + width 3px) the ring
 * painted 4px past the border box on every side: it bled past the container
 * boundary (clipped where an app sidebar sets `overflow: hidden`) and, for the
 * trigger, 4px down into the active "Phoenix" row whose `--cinder-surface-inset`
 * background occupies those same pixels — flattening the focus signal against
 * selection.
 *
 * This spec drives the component with REAL KEYBOARD navigation (programmatic
 * .focus() does NOT engage `:focus-visible` in Chromium — proven below by
 * asserting `element.matches(':focus-visible')` only after a Tab walk) and
 * proves the post-fix Strategy B-inset behavior:
 *   1. Focused group trigger paints an INSET ring in the resolved ring color,
 *      bounded by its own border box (no overhang past the nav's right edge
 *      even though the trigger reaches that edge — an outset ring WOULD
 *      overhang).
 *   2. The inset ring does not cross the trigger's bottom edge into the active
 *      "Phoenix" row directly below it.
 *   3. The focused active "Phoenix" item shows the inset ring AND its active
 *      affordances simultaneously — the surface-inset background fill and the
 *      inline-start accent bar — proving focus and selection read distinctly.
 *
 * Color comparisons round-trip through the browser (resolve the authored token
 * on a probe, read the computed value) so both sides are normalized rgb()/oklch
 * strings, never authored token text against computed values.
 */

import { expect, test, type Page } from '@playwright/test';

const ROUTE = '/page/side-navigation?snapshot=1';

// Browsers can return fractional pixel values for box metrics; match within a
// sub-pixel tolerance.
const PIXEL_TOLERANCE = 0.5;

const TRIGGER_SELECTOR = '.cinder-side-navigation-group__trigger';
const ACTIVE_ITEM_SELECTOR = ".cinder-navigation-item[data-variant='vertical'][data-active='true']";

/**
 * Resolve an authored CSS token (e.g. `var(--cinder-ring-color)`'s value) to a
 * browser-computed color string by painting it onto a probe element. Both sides
 * of a color comparison then come out of the same engine.
 */
async function resolveTokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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

/**
 * Resolve any CSS color string to its alpha channel, in the browser. cinder
 * tokens are authored in oklch(), so a naive rgb() regex would choke; painting
 * the color onto a 1x1 canvas normalizes every color space to an rgba sample.
 */
async function colorAlpha(page: Page, color: string): Promise<number> {
  return page.evaluate((value) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(`2d canvas context unavailable resolving color: ${value}`);
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    return (context.getImageData(0, 0, 1, 1).data[3] ?? 0) / 255;
  }, color);
}

/**
 * Reset focus to the document body, then walk Tab (capped) until `locator` is
 * the active element. Returns once focus lands; throws via the caller's
 * subsequent assertion if it never does.
 */
async function tabUntilFocused(page: Page, locator: ReturnType<Page['locator']>): Promise<boolean> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.focus();
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await page.keyboard.press('Tab');
    const landed = await locator.evaluate((element) => element === document.activeElement);
    if (landed) return true;
  }
  return false;
}

test.describe('SideNavigation — grouped focus ring is inset and unclipped', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: 'load' });
    // `networkidle` lets the playground bundle and any lazy CSS settle so the
    // computed-style reads below aren't racing the load.
    await page.waitForLoadState('networkidle');
    await page.waitForSelector(TRIGGER_SELECTOR, { state: 'visible' });
    // Wait for layout (non-zero box) before measuring geometry.
    await page.waitForFunction((selector) => {
      const element = document.querySelector(selector);
      return element instanceof HTMLElement && element.getBoundingClientRect().height > 0;
    }, TRIGGER_SELECTOR);
  });

  test('group trigger: keyboard focus paints a complete inset ring with no overhang or neighbor bleed', async ({
    page,
  }) => {
    // The "Projects" group is the trigger that owns the active "Phoenix" item.
    const trigger = page.locator(TRIGGER_SELECTOR, { hasText: 'Projects' }).first();
    await expect(trigger).toBeVisible();

    // Real keyboard navigation — programmatic .focus() does NOT engage
    // :focus-visible in Chromium, which is the pseudo-class the ring keys off.
    const landed = await tabUntilFocused(page, trigger);
    expect(landed, 'Tab walk should land on the Projects group trigger').toBe(true);
    await expect(trigger).toBeFocused();

    const ringColor = await resolveTokenColor(page, '--cinder-ring-color');

    // The SideNavigation root is the container the trigger is full-bleed against.
    const nav = page.locator('.cinder-side-navigation').first();
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();

    const measurement = await trigger.evaluate((element) => {
      const styles = getComputedStyle(element as HTMLElement);
      const rect = element.getBoundingClientRect();
      return {
        matchesFocusVisible: element.matches(':focus-visible'),
        boxShadow: styles.boxShadow,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        top: rect.top,
      };
    });

    // (a) Real keyboard focus engaged :focus-visible.
    expect(measurement.matchesFocusVisible).toBe(true);

    // (b) The ring is the INSET single-band ring in the resolved ring color —
    // computed box-shadow serializes the `inset` keyword. The pre-fix OUTSET
    // recipe has no `inset` keyword, so this assertion fails on pre-fix code.
    expect(measurement.boxShadow).not.toBe('none');
    expect(measurement.boxShadow).toContain('inset');
    expect(measurement.boxShadow).toContain(ringColor);

    // The inset ring is a single layer (no offset band). The pre-fix outset
    // ring is two layers (offset-color band + ring-color band). Count top-level
    // comma-separated layers; computed colors use space-separated channels, so
    // the only top-level commas separate layers.
    const layerCount = measurement.boxShadow.split(/,(?![^(]*\))/).length;
    expect(layerCount, 'inset ring is a single box-shadow layer').toBe(1);

    // (c) The trigger reaches the nav's right edge (it is full-bleed), proving
    // an OUTSET ring WOULD overhang the container — yet the painted ring stays
    // within the element box because it is inset.
    expect(measurement.right).toBeLessThanOrEqual(navBox!.x + navBox!.width + PIXEL_TOLERANCE);
    expect(
      Math.abs(measurement.right - (navBox!.x + navBox!.width)),
      'trigger reaches the nav right edge (full-bleed)',
    ).toBeLessThanOrEqual(2);

    // (d) No neighbor bleed: the active item sits directly below the trigger.
    // An inset ring is bounded by trigger.bottom, so it cannot reach into the
    // active row. Assert the active item's top is at/below the trigger bottom
    // (they are adjacent) — the inset ring lives entirely above that boundary.
    const activeTop = await page
      .locator(ACTIVE_ITEM_SELECTOR)
      .first()
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(activeTop).toBeGreaterThanOrEqual(measurement.bottom - PIXEL_TOLERANCE);
  });

  test('active item: keyboard focus shows the inset ring AND the active background + accent bar together', async ({
    page,
  }) => {
    const active = page.locator(ACTIVE_ITEM_SELECTOR).first();
    await expect(active).toBeVisible();
    await expect(active).toHaveText('Phoenix');

    const landed = await tabUntilFocused(page, active);
    expect(landed, 'Tab walk should land on the active Phoenix item').toBe(true);
    await expect(active).toBeFocused();

    const ringColor = await resolveTokenColor(page, '--cinder-ring-color');
    const accentColor = await resolveTokenColor(page, '--cinder-accent');

    const measurement = await active.evaluate((element) => {
      const styles = getComputedStyle(element as HTMLElement);
      return {
        matchesFocusVisible: element.matches(':focus-visible'),
        boxShadow: styles.boxShadow,
        backgroundColor: styles.backgroundColor,
        borderInlineStartColor: styles.borderInlineStartColor,
      };
    });

    // Real keyboard focus engaged :focus-visible.
    expect(measurement.matchesFocusVisible).toBe(true);

    // Focus signal: the inset ring in the resolved ring color.
    expect(measurement.boxShadow).not.toBe('none');
    expect(measurement.boxShadow).toContain('inset');
    expect(measurement.boxShadow).toContain(ringColor);
    const layerCount = measurement.boxShadow.split(/,(?![^(]*\))/).length;
    expect(layerCount, 'inset ring is a single box-shadow layer').toBe(1);

    // Selection signal #1: the surface-inset background fill is still painted
    // (non-transparent) under the focused row — focus does not cover it.
    expect(
      await colorAlpha(page, measurement.backgroundColor),
      'active item keeps its surface-inset background while focused',
    ).toBeGreaterThan(0);

    // Selection signal #2: the inline-start accent bar is the resolved accent
    // color — a different channel from the ring, so focus and selection are
    // simultaneously present and distinct.
    expect(measurement.borderInlineStartColor).toBe(accentColor);
  });
});
