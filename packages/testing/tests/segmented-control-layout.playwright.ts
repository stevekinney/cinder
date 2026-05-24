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
 *      font-size and inline padding (so toolbar inherits sm's compact
 *      typography), while option `min-block-size` pins to
 *      `--cinder-control-height-sm` so the bounding height aligns with
 *      sibling toolbar controls (Chip, DiffStatistics, Button size="sm").
 *   4. Attached horizontal sm/md options have at least 12px of inline
 *      padding on both sides so labels don't pinch against the
 *      inter-segment divider — checked across default, selected, focused,
 *      and disabled states.
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
  expect(raw, `expected ${token} to resolve on :root`).not.toBe('');
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
    // `networkidle` waits for the playground bundle and any lazy fonts/CSS
    // to settle so subsequent computed-style reads aren't racing the load.
    await page.waitForLoadState('networkidle');

    // The sizing example renders six controls with stable ids. Wait for the
    // last sibling to mount AND for its first option to have a non-zero
    // bounding box so subsequent page.evaluate() reads see resolved layout
    // (waitForSelector alone only proves DOM presence, not layout).
    await page.waitForSelector('#segmented-sizing-sm', { state: 'visible' });
    await page.waitForSelector('#segmented-sizing-toolbar-lg', { state: 'visible' });
    await page.waitForFunction(() => {
      const last = document.querySelector(
        '#segmented-sizing-toolbar-lg .cinder-segmented-control-option',
      );
      return last instanceof HTMLElement && last.getBoundingClientRect().height > 0;
    });

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
    await expect(page.locator('#segmented-sizing-sm')).toHaveAttribute('data-cinder-size', 'sm');
    await expect(page.locator('#segmented-sizing-md')).toHaveAttribute('data-cinder-size', 'md');
    await expect(page.locator('#segmented-sizing-lg')).toHaveAttribute('data-cinder-size', 'lg');

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

    // ── Toolbar density: sm typography, control-height-sm bounding height ─
    // Compare the same enabled, non-focused option index (the first, "Source")
    // across the structurally identical sm / toolbar / toolbar-md / toolbar-lg
    // controls. Font size, block padding, and inline padding all inherit from
    // the `sm` rule. Bounding height does NOT match sm — toolbar density
    // pins min-block-size to `--cinder-control-height-sm` so the option
    // aligns with sibling toolbar controls (Chip, DiffStatistics, Button
    // size="sm"), which is the contract `density="toolbar"` advertises.
    const referenceSelector = '#segmented-sizing-sm .cinder-segmented-control-option:nth-child(1)';
    const referenceMetrics = await optionMetrics(page, referenceSelector);
    const controlHeightSmPx = await resolvedRootTokenPx(page, '--cinder-control-height-sm');

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
      // Toolbar height pins to --cinder-control-height-sm (32px), not to
      // sm's 24px. Use precision 1 (±0.05px) to match the rest of the block.
      expect(
        candidate.height,
        `${id}: bounding height matches --cinder-control-height-sm`,
      ).toBeCloseTo(controlHeightSmPx, 1);
    }

    // ── 12px divider breathing on attached horizontal sm/md options ───────
    // Walk every option across every attached horizontal sm/md control
    // rendered by the sizing example (lg already uses --cinder-space-3 from
    // its size rule and is intentionally excluded from the override). This
    // covers default, selected ("rendered"), and disabled ("diff") states
    // inherently. The focused state is exercised by keyboard navigation
    // below.
    const optionPadding = await page
      .locator(
        '.cinder-segmented-control:not([data-cinder-detached])[data-cinder-orientation="horizontal"] .cinder-segmented-control-option',
      )
      .evaluateAll((elements) =>
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
    // Engage keyboard focus on a segment so the browser sets :focus-visible
    // — the pseudo-class the focus-ring CSS keys off. SegmentedControl uses
    // roving tabindex: only the currently selected (or first enabled)
    // segment has tabindex=0, so Tab lands on that one. The example
    // initializes value="rendered", so Tab → focuses the "Rendered" segment.
    // Programmatic .focus() does NOT engage :focus-visible in Chromium, so
    // we dispatch via the keyboard. Walk Tab from the document start; the
    // sm sizing control's selected segment is the first non-app focusable.
    await page.evaluate(() => {
      // Reset focus to the body so the next Tab is deterministic.
      document.body.focus();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    const focusedSegment = page.locator(
      '#segmented-sizing-sm .cinder-segmented-control-option[tabindex="0"]',
    );
    // Cap the Tab walk at 50 — the playground header chrome may include
    // several focusable elements before the example content.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await page.keyboard.press('Tab');
      const landed = await focusedSegment.evaluate((element) => element === document.activeElement);
      if (landed) break;
    }
    await expect(focusedSegment).toBeFocused();
    const focusedPadding = await focusedSegment.evaluate((element) => {
      const styles = getComputedStyle(element as HTMLElement);
      return {
        inlineStart: Number.parseFloat(styles.paddingInlineStart || styles.paddingLeft),
        inlineEnd: Number.parseFloat(styles.paddingInlineEnd || styles.paddingRight),
        matchesFocusVisible: element.matches(':focus-visible'),
      };
    });
    expect(focusedPadding.matchesFocusVisible).toBe(true);
    expect(focusedPadding.inlineStart).toBeGreaterThanOrEqual(12 - PIXEL_TOLERANCE);
    expect(focusedPadding.inlineEnd).toBeGreaterThanOrEqual(12 - PIXEL_TOLERANCE);
  });

  test('review-editor view switcher reports resolved sm + toolbar contract', async ({ page }) => {
    await page.goto(REVIEW_EDITOR_ROUTE, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    // The review-editor view switcher is a tablist with the documented
    // size="sm" + density="toolbar" combination. Selecting by tablist role
    // avoids depending on the surrounding example's ids. Wait for the
    // tablist to mount before asserting so a missing element surfaces as a
    // clear "selector not found" rather than a timeout on toHaveAttribute.
    await page.waitForSelector('.cinder-segmented-control[data-cinder-variant="tablist"]', {
      state: 'visible',
    });
    const tablist = page
      .locator('.cinder-segmented-control[data-cinder-variant="tablist"]')
      .first();
    await expect(tablist).toHaveAttribute('data-cinder-size', 'sm');
    await expect(tablist).toHaveAttribute('data-cinder-density', 'toolbar');
  });
});
