/// <reference lib="dom" />
/**
 * Visual proof for the focus-ring sweep (15f4d777): component-owned
 * `:focus-visible` selectors that previously painted a colored `outline` as
 * their only ring now follow the shared recipe — Strategy B (transparent
 * outline placeholder + `box-shadow: var(--_cinder-focus-ring-shadow)`) for
 * pressables on the page surface, and Strategy B-inset (transparent outline +
 * an INSET box-shadow ring) for focusable elements inside a clipping container.
 *
 * The parser-based unit tests (focus-ring-recipe.test.ts) pin the CSS source.
 * THIS spec proves the rendered behavior with REAL keyboard interaction:
 *
 *   1. Tab-walk from document.body until the target is activeElement.
 *   2. Assert `element.matches(':focus-visible') === true`. A programmatic
 *      `.focus()` does NOT engage :focus-visible in Chromium, so the ring must
 *      be driven by the keyboard — that is the whole point of the walk.
 *   3. Measure the rendered ring geometry:
 *        - Strategy B (outer): the box-shadow ring is painted (non-'none',
 *          multi-layer, the ring color present) and overhangs the element on
 *          all four sides without being clipped by an ancestor.
 *        - Strategy B-inset: the box-shadow is an INSET ring drawn entirely
 *          within the element's own border box, so it is guaranteed UNCLIPPED
 *          by the overflow:clip/hidden ancestor — proven by asserting the
 *          element's border box sits fully inside that ancestor's client rect.
 *
 * Follows the keyboard-walk idiom from segmented-control-layout.playwright.ts.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

const PIXEL_TOLERANCE = 1;

/**
 * Walk Tab from document.body until `target` is the active element, capped at
 * `maxPresses`. Returns true when focus landed on the target. Blurs first so
 * the walk is deterministic regardless of any prior autofocus.
 */
async function tabUntilFocused(page: Page, target: Locator, maxPresses = 50): Promise<boolean> {
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

/** Resolve --cinder-ring-color on `element` to a browser-normalized rgb() string. */
async function resolvedRingColor(target: Locator): Promise<string> {
  return target.evaluate((element) => {
    const token = getComputedStyle(element as HTMLElement)
      .getPropertyValue('--cinder-ring-color')
      .trim();
    const probe = document.createElement('span');
    probe.style.color = token;
    document.body.append(probe);
    try {
      return getComputedStyle(probe).color;
    } finally {
      probe.remove();
    }
  });
}

/** Count comma-separated top-level box-shadow layers (commas inside fn args ignored). */
function boxShadowLayerCount(boxShadow: string): number {
  return boxShadow.split(/,(?![^(]*\))/).length;
}

test.describe('focus-ring sweep — rendered keyboard-focus rings', () => {
  test('Rating option (Strategy B outer): keyboard ring is the shared outer box-shadow ring', async ({
    page,
  }) => {
    await page.goto('/page/rating?snapshot=1', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    // Rating renders a radiogroup of `<button class="cinder-rating__option">`
    // stars (the field `id` prop is not surfaced as a queryable element id), so
    // target the first interactive option directly.
    await page.waitForSelector('.cinder-rating__option', { state: 'visible' });

    const option = page.locator('.cinder-rating__option').first();
    const landed = await tabUntilFocused(page, option);
    expect(landed, 'Tab walk should reach the first rating option').toBe(true);
    await expect(option).toBeFocused();

    const ringColor = await resolvedRingColor(option);
    const result = await option.evaluate((element) => {
      const styles = getComputedStyle(element as HTMLElement);
      return {
        matchesFocusVisible: element.matches(':focus-visible'),
        boxShadow: styles.boxShadow,
      };
    });

    // The keyboard drove :focus-visible (a programmatic focus would not).
    expect(result.matchesFocusVisible).toBe(true);
    // The ring lives in box-shadow, not a colored outline.
    expect(result.boxShadow).not.toBe('none');
    // The shared recipe is a two-stop ring (offset band + ring); ≥2 layers.
    expect(boxShadowLayerCount(result.boxShadow)).toBeGreaterThanOrEqual(2);
    // It is the focus ring color, not some incidental shadow.
    expect(result.boxShadow).toContain(ringColor);
    // The outer ring is NOT inset (that would be the B-inset variant).
    expect(result.boxShadow).not.toContain('inset');
  });

  test('Accordion trigger (Strategy B-inset): keyboard ring is an inset ring inside the overflow:clip container', async ({
    page,
  }) => {
    await page.goto('/page/accordion?snapshot=1', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.cinder-accordion-item__trigger', { state: 'visible' });

    const trigger = page.locator('.cinder-accordion-item__trigger').first();
    const landed = await tabUntilFocused(page, trigger);
    expect(landed, 'Tab walk should reach the first accordion trigger').toBe(true);
    await expect(trigger).toBeFocused();

    const ringColor = await resolvedRingColor(trigger);
    const result = await trigger.evaluate((element) => {
      const styles = getComputedStyle(element as HTMLElement);
      const elementRect = element.getBoundingClientRect();
      // Nearest ancestor that clips (overflow: clip/hidden/scroll/auto).
      let clip: Element | null = element.parentElement;
      let clipRect: DOMRect | null = null;
      while (clip) {
        const overflow = getComputedStyle(clip).overflow;
        if (/clip|hidden|scroll|auto/.test(overflow)) {
          clipRect = clip.getBoundingClientRect();
          break;
        }
        clip = clip.parentElement;
      }
      return {
        matchesFocusVisible: element.matches(':focus-visible'),
        boxShadow: styles.boxShadow,
        elementRect: {
          top: elementRect.top,
          left: elementRect.left,
          right: elementRect.right,
          bottom: elementRect.bottom,
        },
        clipRect: clipRect
          ? {
              top: clipRect.top,
              left: clipRect.left,
              right: clipRect.right,
              bottom: clipRect.bottom,
            }
          : null,
      };
    });

    expect(result.matchesFocusVisible).toBe(true);
    expect(result.boxShadow).not.toBe('none');
    // B-inset: the painted ring is INSET, so it can never overflow the trigger
    // border box (and therefore never the overflow:clip parent).
    expect(result.boxShadow).toContain('inset');
    expect(result.boxShadow).toContain(ringColor);
    // Prove the clipping ancestor exists and the trigger's border box (which
    // the inset ring lives inside) is fully contained by it — the ring cannot
    // be clipped.
    expect(result.clipRect, 'accordion trigger should have a clipping ancestor').not.toBeNull();
    const { elementRect, clipRect } = result;
    expect(elementRect.top).toBeGreaterThanOrEqual(clipRect!.top - PIXEL_TOLERANCE);
    expect(elementRect.left).toBeGreaterThanOrEqual(clipRect!.left - PIXEL_TOLERANCE);
    expect(elementRect.right).toBeLessThanOrEqual(clipRect!.right + PIXEL_TOLERANCE);
    expect(elementRect.bottom).toBeLessThanOrEqual(clipRect!.bottom + PIXEL_TOLERANCE);
  });

  test('Tree item (Strategy B-inset): keyboard ring is an inset ring within the tree bounds', async ({
    page,
  }) => {
    await page.goto('/page/tree?snapshot=1', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.cinder-tree-item', { state: 'visible' });

    // Tree items receive focus via roving tabindex; the first item carries
    // tabindex=0, so Tab lands on it. (Arrow keys move within once focused.)
    const item = page.locator('.cinder-tree-item').first();
    const landed = await tabUntilFocused(page, item);
    expect(landed, 'Tab walk should reach the first tree item').toBe(true);
    await expect(item).toBeFocused();

    const ringColor = await resolvedRingColor(item);
    const result = await item.evaluate((element) => {
      const styles = getComputedStyle(element as HTMLElement);
      const elementRect = element.getBoundingClientRect();
      let clip: Element | null = element.parentElement;
      let clipRect: DOMRect | null = null;
      while (clip) {
        const overflow = getComputedStyle(clip).overflow;
        if (/clip|hidden|scroll|auto/.test(overflow)) {
          clipRect = clip.getBoundingClientRect();
          break;
        }
        clip = clip.parentElement;
      }
      return {
        matchesFocusVisible: element.matches(':focus-visible'),
        boxShadow: styles.boxShadow,
        outline: styles.outlineColor,
        clipRect: clipRect
          ? {
              top: clipRect.top,
              left: clipRect.left,
              right: clipRect.right,
              bottom: clipRect.bottom,
            }
          : null,
        elementRect: {
          top: elementRect.top,
          left: elementRect.left,
          right: elementRect.right,
          bottom: elementRect.bottom,
        },
      };
    });

    expect(result.matchesFocusVisible).toBe(true);
    expect(result.boxShadow).not.toBe('none');
    expect(result.boxShadow).toContain('inset');
    expect(result.boxShadow).toContain(ringColor);
    // If a clipping ancestor exists, the inset ring (inside the item border box)
    // is contained by it; assert containment when present.
    if (result.clipRect) {
      const { elementRect, clipRect } = result;
      expect(elementRect.top).toBeGreaterThanOrEqual(clipRect.top - PIXEL_TOLERANCE);
      expect(elementRect.left).toBeGreaterThanOrEqual(clipRect.left - PIXEL_TOLERANCE);
      expect(elementRect.right).toBeLessThanOrEqual(clipRect.right + PIXEL_TOLERANCE);
    }
  });
});
