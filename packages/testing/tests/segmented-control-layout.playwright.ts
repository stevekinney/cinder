/// <reference lib="dom" />
/**
 * Regression test for `SegmentedControl` size, density, and divider sizing.
 *
 * Covers the contract introduced by the P6 sizing pass:
 *   1. `data-cinder-size` reflects resolved visual size — `density="toolbar"`
 *      forces `data-cinder-size="sm"` regardless of any explicit `size` prop.
 *   2. `size="md"` option text uses `--cinder-text-sm` (promoted from
 *      `--cinder-text-xs`); `size="sm"` stays at `--cinder-text-xs`.
 *   3. Toolbar-density options match the same-page `size="sm"` control on
 *      font-size, padding, and bounding height.
 *   4. Attached horizontal options have at least 12px of inline padding on
 *      both sides so labels don't pinch against the inter-segment divider —
 *      checked across default, selected, focused, and disabled states.
 *   5. The review-editor view switcher reports the documented resolved
 *      contract: `data-cinder-size="sm"`, `data-cinder-density="toolbar"`.
 */

import { expect, test, type Page } from '@playwright/test';

const SIZING_ROUTE = '/page/segmented-control?snapshot=1';
const REVIEW_EDITOR_ROUTE = '/page/review-editor?snapshot=1';

// Match Playwright's bounding box / padding numerics within a sub-pixel
// tolerance. Browsers can return fractional pixel values for box metrics.
const PIXEL_TOLERANCE = 0.5;

async function resolvedRootTokenPx(page: Page, token: string): Promise<number> {
  const raw = await page.evaluate(
    (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    token,
  );
  expect(raw, `expected --${token} to resolve on :root`).not.toBe('');
  // Tokens are authored in rem; convert to the px value the browser will
  // ultimately render. `font-size: var(--cinder-text-sm)` cascades into
  // `getComputedStyle().fontSize` as a px string, so the comparison must be
  // in px on both sides.
  if (raw.endsWith('rem')) {
    const remValue = Number.parseFloat(raw);
    const rootFontSize = await page.evaluate(
      () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
    );
    return remValue * rootFontSize;
  }
  if (raw.endsWith('px')) return Number.parseFloat(raw);
  throw new Error(`Unsupported unit for --${token}: ${raw}`);
}

type OptionMetrics = {
  fontSize: number;
  paddingBlockStart: number;
  paddingBlockEnd: number;
  paddingInlineStart: number;
  paddingInlineEnd: number;
  width: number;
  height: number;
};

async function optionMetrics(page: Page, selector: string): Promise<OptionMetrics> {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Selector did not match an HTMLElement: ${sel}`);
    }
    const styles = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      fontSize: Number.parseFloat(styles.fontSize),
      paddingBlockStart: Number.parseFloat(styles.paddingBlockStart || styles.paddingTop),
      paddingBlockEnd: Number.parseFloat(styles.paddingBlockEnd || styles.paddingBottom),
      paddingInlineStart: Number.parseFloat(styles.paddingInlineStart || styles.paddingLeft),
      paddingInlineEnd: Number.parseFloat(styles.paddingInlineEnd || styles.paddingRight),
      width: rect.width,
      height: rect.height,
    };
  }, selector);
}

test.describe('SegmentedControl — sizing and density', () => {
  test('resolved size, font tokens, and divider breathing match the contract', async ({ page }) => {
    await page.goto(SIZING_ROUTE, { waitUntil: 'load' });

    // The sizing example renders six controls with stable ids. Wait for the
    // small control to mount before measuring; the others are siblings in the
    // same example bundle and mount together.
    await page.waitForSelector('#segmented-sizing-sm', { state: 'visible' });

    // ── Resolved-size DOM contract ────────────────────────────────────────
    for (const id of [
      'segmented-sizing-toolbar',
      'segmented-sizing-toolbar-md',
      'segmented-sizing-toolbar-lg',
    ]) {
      const control = page.locator(`#${id}`);
      await expect(control).toHaveAttribute('data-cinder-size', 'sm');
      await expect(control).toHaveAttribute('data-cinder-density', 'toolbar');
    }
    await expect(page.locator('#segmented-sizing-md')).toHaveAttribute('data-cinder-size', 'md');
    await expect(page.locator('#segmented-sizing-sm')).toHaveAttribute('data-cinder-size', 'sm');

    // ── Font tokens ───────────────────────────────────────────────────────
    const textSmPx = await resolvedRootTokenPx(page, '--cinder-text-sm');
    const textXsPx = await resolvedRootTokenPx(page, '--cinder-text-xs');

    const mdMetrics = await optionMetrics(
      page,
      '#segmented-sizing-md .cinder-segmented-control-option',
    );
    expect(mdMetrics.fontSize).toBeCloseTo(textSmPx, 1);

    const smMetrics = await optionMetrics(
      page,
      '#segmented-sizing-sm .cinder-segmented-control-option',
    );
    expect(smMetrics.fontSize).toBeCloseTo(textXsPx, 1);

    // ── Toolbar density matches same-page size="sm" ───────────────────────
    // Compare the same enabled, non-focused option index (the first, "Source")
    // across the structurally identical sm / toolbar / toolbar-md / toolbar-lg
    // controls. All six controls share the same options and selected value so
    // bounding boxes and computed styles can be compared directly.
    const referenceSelector = '#segmented-sizing-sm .cinder-segmented-control-option:nth-child(1)';
    const referenceMetrics = await optionMetrics(page, referenceSelector);

    for (const id of [
      'segmented-sizing-toolbar',
      'segmented-sizing-toolbar-md',
      'segmented-sizing-toolbar-lg',
    ]) {
      const candidate = await optionMetrics(
        page,
        `#${id} .cinder-segmented-control-option:nth-child(1)`,
      );
      expect(candidate.fontSize, `${id}: font-size matches sm`).toBeCloseTo(
        referenceMetrics.fontSize,
        1,
      );
      expect(candidate.paddingBlockStart, `${id}: padding-block-start matches sm`).toBeCloseTo(
        referenceMetrics.paddingBlockStart,
        1,
      );
      expect(candidate.paddingBlockEnd, `${id}: padding-block-end matches sm`).toBeCloseTo(
        referenceMetrics.paddingBlockEnd,
        1,
      );
      expect(candidate.paddingInlineStart, `${id}: padding-inline-start matches sm`).toBeCloseTo(
        referenceMetrics.paddingInlineStart,
        1,
      );
      expect(candidate.paddingInlineEnd, `${id}: padding-inline-end matches sm`).toBeCloseTo(
        referenceMetrics.paddingInlineEnd,
        1,
      );
      expect(candidate.height, `${id}: bounding height matches sm`).toBeCloseTo(
        referenceMetrics.height,
        0,
      );
    }

    // ── 12px divider breathing on attached horizontal options ─────────────
    // Walk every option across every attached horizontal control rendered by
    // the sizing example. This covers default, selected ("rendered"), and
    // disabled ("diff") states inherently. The focused state is exercised
    // below by programmatic focus on the first option.
    const optionPadding = await page.$$eval(
      '.cinder-segmented-control:not([data-cinder-detached])[data-cinder-orientation="horizontal"] .cinder-segmented-control-option',
      (elements) =>
        elements.map((element) => {
          const styles = getComputedStyle(element as HTMLElement);
          return {
            inlineStart: Number.parseFloat(styles.paddingInlineStart || styles.paddingLeft),
            inlineEnd: Number.parseFloat(styles.paddingInlineEnd || styles.paddingRight),
          };
        }),
    );
    expect(optionPadding.length).toBeGreaterThan(0);
    for (const padding of optionPadding) {
      expect(padding.inlineStart).toBeGreaterThanOrEqual(12 - PIXEL_TOLERANCE);
      expect(padding.inlineEnd).toBeGreaterThanOrEqual(12 - PIXEL_TOLERANCE);
    }

    // ── Focused-state padding contract ────────────────────────────────────
    // Focus an option and re-measure to prove the focus ring (which is drawn
    // via box-shadow, not padding) doesn't eat into the inline padding.
    await page.locator('#segmented-sizing-sm .cinder-segmented-control-option').first().focus();
    const focusedPadding = await page.$eval(
      '#segmented-sizing-sm .cinder-segmented-control-option:focus',
      (element) => {
        const styles = getComputedStyle(element as HTMLElement);
        return {
          inlineStart: Number.parseFloat(styles.paddingInlineStart || styles.paddingLeft),
          inlineEnd: Number.parseFloat(styles.paddingInlineEnd || styles.paddingRight),
        };
      },
    );
    expect(focusedPadding.inlineStart).toBeGreaterThanOrEqual(12 - PIXEL_TOLERANCE);
    expect(focusedPadding.inlineEnd).toBeGreaterThanOrEqual(12 - PIXEL_TOLERANCE);
  });

  test('review-editor view switcher reports resolved sm + toolbar contract', async ({ page }) => {
    await page.goto(REVIEW_EDITOR_ROUTE, { waitUntil: 'load' });
    // The review-editor view switcher is a tablist with the documented
    // size="sm" + density="toolbar" combination. Selecting by tablist role
    // avoids depending on the surrounding example's ids.
    const tablist = page
      .locator('.cinder-segmented-control[data-cinder-variant="tablist"]')
      .first();
    await expect(tablist).toHaveAttribute('data-cinder-size', 'sm');
    await expect(tablist).toHaveAttribute('data-cinder-density', 'toolbar');
  });
});
