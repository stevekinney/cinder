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

/**
 * Regression test for the `variant="tablist"` visual treatment introduced by
 * task eef4318f (executing docs/decisions/segmented-control-tablist-variant.md).
 *
 * The tablist variant must read as a tab strip rather than the default
 * filled-pill radiogroup: no enclosing surface, no separators, and an
 * accent-colored edge indicator on the selected tab (block-end edge for
 * horizontal tablists, inline-start edge for vertical). The radiogroup and
 * multiple-selection variants on the same page must stay visually unchanged,
 * and the review-editor toolbar-nested tablist must keep its roving keyboard
 * contract instead of having arrow keys stolen by the surrounding toolbar.
 *
 * Color comparisons round-trip both sides through the browser (resolve
 * --cinder-accent from the live element, read the indicator's computed
 * background) so we compare normalized rgb() strings, never authored token
 * text against computed values. Transparency and visibility use alpha and size
 * predicates rather than exact string matching.
 */

const HORIZONTAL_TABLIST = '#segmented-tablist-horizontal';
const VERTICAL_TABLIST = '#segmented-tablist-vertical';

/**
 * Resolve any CSS color string to its alpha channel, in the browser. cinder
 * tokens are authored in oklch(), so a naive rgb() regex would choke; painting
 * the color onto a canvas normalizes every color space to an rgba sample and
 * lets us assert transparency (alpha 0) vs. opacity (alpha > 0) reliably.
 */
async function colorAlpha(page: Page, color: string): Promise<number> {
  return page.evaluate((value) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(`2d canvas context unavailable resolving color: ${value}`);
    // Clear to fully transparent, then paint the candidate color. If the color
    // is itself transparent the sampled alpha stays 0.
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    return (context.getImageData(0, 0, 1, 1).data[3] ?? 0) / 255;
  }, color);
}

test.describe('SegmentedControl — tablist variant visual contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIZING_ROUTE, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector(`${HORIZONTAL_TABLIST} .cinder-segmented-control-option`, {
      state: 'visible',
    });
    await page.waitForSelector(`${VERTICAL_TABLIST} .cinder-segmented-control-option`, {
      state: 'visible',
    });
    await page.waitForFunction((selector) => {
      const option = document.querySelector(`${selector} .cinder-segmented-control-option`);
      return option instanceof HTMLElement && option.getBoundingClientRect().height > 0;
    }, HORIZONTAL_TABLIST);
  });

  test('tablist container drops the surface inset: no border, transparent background, no inset padding', async ({
    page,
  }) => {
    const chrome = await page.locator(HORIZONTAL_TABLIST).evaluate((element) => {
      const styles = getComputedStyle(element as HTMLElement);
      return {
        borderTopWidth: styles.borderTopWidth,
        borderRightWidth: styles.borderRightWidth,
        borderBottomWidth: styles.borderBottomWidth,
        borderLeftWidth: styles.borderLeftWidth,
        background: styles.backgroundColor,
        paddingTop: styles.paddingTop,
        paddingRight: styles.paddingRight,
        paddingBottom: styles.paddingBottom,
        paddingLeft: styles.paddingLeft,
      };
    });
    for (const width of [
      chrome.borderTopWidth,
      chrome.borderRightWidth,
      chrome.borderBottomWidth,
      chrome.borderLeftWidth,
    ]) {
      expect(Number.parseFloat(width)).toBe(0);
    }
    expect(await colorAlpha(page, chrome.background)).toBe(0);
    for (const padding of [
      chrome.paddingTop,
      chrome.paddingRight,
      chrome.paddingBottom,
      chrome.paddingLeft,
    ]) {
      expect(Number.parseFloat(padding)).toBe(0);
    }
  });

  test('selected tab has no filled pill: transparent background and no selected shadow', async ({
    page,
  }) => {
    // Move focus off the active element so :focus-visible chrome (a box-shadow
    // ring) does not contaminate the unfocused selected-state read.
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    const selected = await page
      .locator(`${HORIZONTAL_TABLIST} .cinder-segmented-control-option[data-cinder-selected]`)
      .evaluate((element) => {
        const styles = getComputedStyle(element as HTMLElement);
        return { background: styles.backgroundColor, boxShadow: styles.boxShadow };
      });
    expect(await colorAlpha(page, selected.background)).toBe(0);
    expect(selected.boxShadow).toBe('none');
  });

  test('connected-bar separators are suppressed for tablists', async ({ page }) => {
    const separator = await page
      .locator(`${HORIZONTAL_TABLIST} .cinder-segmented-control-option:nth-child(2)`)
      .evaluate((element) => {
        const styles = getComputedStyle(element as HTMLElement, '::before');
        return {
          content: styles.content,
          display: styles.display,
          borderInlineStartWidth: styles.borderInlineStartWidth || styles.borderLeftWidth,
        };
      });
    // content: none removes the pseudo-element entirely; assert that, with
    // fallbacks for engines that still expose a zero-width / non-displayed box.
    const suppressed =
      separator.content === 'none' ||
      separator.display === 'none' ||
      Number.parseFloat(separator.borderInlineStartWidth) === 0;
    expect(suppressed).toBe(true);
  });

  test('horizontal selected tab draws an accent indicator on the block-end edge', async ({
    page,
  }) => {
    const indicator = await page
      .locator(`${HORIZONTAL_TABLIST} .cinder-segmented-control-option[data-cinder-selected]`)
      .evaluate((element) => {
        const after = getComputedStyle(element as HTMLElement, '::after');
        const accent = getComputedStyle(element as HTMLElement)
          .getPropertyValue('--cinder-accent')
          .trim();
        // Resolve the authored accent token to a computed rgb() by painting it
        // onto a probe element, so both sides of the color comparison are
        // browser-normalized. getComputedStyle needs the probe in the document,
        // so use try/finally to guarantee removal even if a read throws.
        const probe = document.createElement('span');
        probe.style.color = accent;
        document.body.append(probe);
        let resolvedAccent: string;
        try {
          resolvedAccent = getComputedStyle(probe).color;
        } finally {
          probe.remove();
        }
        return {
          content: after.content,
          position: after.position,
          insetBlockEnd: after.insetBlockEnd,
          blockSize: Number.parseFloat(after.blockSize),
          inlineSize: Number.parseFloat(after.inlineSize),
          background: after.backgroundColor,
          resolvedAccent,
        };
      });
    expect(indicator.content).not.toBe('none');
    expect(indicator.position).toBe('absolute');
    expect(Number.parseFloat(indicator.insetBlockEnd)).toBe(0);
    expect(indicator.blockSize).toBeGreaterThanOrEqual(2 - PIXEL_TOLERANCE);
    expect(indicator.inlineSize).toBeGreaterThan(0);
    // Both sides are browser-computed color strings (oklch for cinder tokens);
    // painting --cinder-accent onto a probe and reading the indicator's
    // computed background yields identical normalized strings.
    expect(indicator.background).toBe(indicator.resolvedAccent);
    expect(await colorAlpha(page, indicator.background)).toBeGreaterThan(0);
  });

  test('vertical selected tab draws an accent indicator on the inline-start edge', async ({
    page,
  }) => {
    const indicator = await page
      .locator(`${VERTICAL_TABLIST} .cinder-segmented-control-option[data-cinder-selected]`)
      .evaluate((element) => {
        const after = getComputedStyle(element as HTMLElement, '::after');
        const accent = getComputedStyle(element as HTMLElement)
          .getPropertyValue('--cinder-accent')
          .trim();
        const probe = document.createElement('span');
        probe.style.color = accent;
        document.body.append(probe);
        let resolvedAccent: string;
        try {
          resolvedAccent = getComputedStyle(probe).color;
        } finally {
          probe.remove();
        }
        return {
          content: after.content,
          position: after.position,
          insetInlineStart: after.insetInlineStart,
          inlineSize: Number.parseFloat(after.inlineSize),
          blockSize: Number.parseFloat(after.blockSize),
          background: after.backgroundColor,
          resolvedAccent,
        };
      });
    expect(indicator.content).not.toBe('none');
    expect(indicator.position).toBe('absolute');
    expect(Number.parseFloat(indicator.insetInlineStart)).toBe(0);
    expect(indicator.inlineSize).toBeGreaterThanOrEqual(2 - PIXEL_TOLERANCE);
    expect(indicator.blockSize).toBeGreaterThan(0);
    expect(indicator.background).toBe(indicator.resolvedAccent);
    expect(await colorAlpha(page, indicator.background)).toBeGreaterThan(0);
  });

  test('focus-visible ring survives on the selected tab and is the ring, not the pill shadow', async ({
    page,
  }) => {
    // The selected ("editor") tab carries tabindex=0 under roving tabindex.
    // Focus it directly — this is a focus-ring style test, not a focus-order
    // test, so a direct .focus() is the right tool (no fragile Tab-count loop).
    const focusTarget = page.locator(
      `${HORIZONTAL_TABLIST} .cinder-segmented-control-option[tabindex="0"][data-cinder-selected]`,
    );
    await focusTarget.focus();
    // Programmatic .focus() does not engage :focus-visible in Chromium; a
    // keyboard interaction does. ArrowLeft wraps focus to the last tab, then
    // ArrowRight returns to "editor" — net tab unchanged, but now keyboard-
    // focused so :focus-visible applies.
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await expect(focusTarget).toBeFocused();

    // Resolve the base ring shadow from a keyboard-focused NON-tablist option
    // on the same page, so the expected value is browser-computed (the ring
    // tokens serialize identically everywhere). The tablist selected+focused
    // tab must paint this exact ring — not the single-layer filled-pill drop
    // shadow, which a bare `!== 'none'` check would falsely accept.
    const focus = await focusTarget.evaluate((element) => {
      const styles = getComputedStyle(element as HTMLElement);
      return {
        matchesFocusVisible: element.matches(':focus-visible'),
        boxShadow: styles.boxShadow,
      };
    });
    expect(focus.matchesFocusVisible).toBe(true);
    expect(focus.boxShadow).not.toBe('none');

    // The ring is a two-layer box-shadow (offset layer + ring layer); the pill
    // drop shadow is a single layer. Count top-level layers by the comma that
    // separates them — computed colors use space-separated channels
    // (`rgb(r g b / a)` / `oklch(...)`) so the only commas are layer
    // separators. ≥2 layers proves the ring survived rather than the pill
    // shadow winning.
    const layerCount = focus.boxShadow.split(/,(?![^(]*\))/).length;
    expect(layerCount).toBeGreaterThanOrEqual(2);

    // And it must be the ring color, not the pill's translucent black drop
    // shadow. Resolve --cinder-ring-color through the browser and assert the
    // computed box-shadow contains it.
    const ringColor = await focusTarget.evaluate((element) => {
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
    expect(focus.boxShadow).toContain(ringColor);
  });

  // ── Non-regression: radiogroup and multiple variants stay filled-pill ──────

  test('default radiogroup selected option keeps the filled accent pill and selected shadow', async ({
    page,
  }) => {
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    const selected = await page
      .locator('#segmented-sizing-md .cinder-segmented-control-option[data-cinder-selected]')
      .evaluate((element) => {
        const styles = getComputedStyle(element as HTMLElement);
        return { background: styles.backgroundColor, boxShadow: styles.boxShadow };
      });
    expect(await colorAlpha(page, selected.background)).toBeGreaterThan(0);
    expect(selected.boxShadow).not.toBe('none');
  });

  test('attached radiogroup still renders separators between unselected neighbors', async ({
    page,
  }) => {
    // The md sizing control selects "rendered" (2nd option); the 3rd option
    // ("Diff") is an unselected neighbor that should still show its separator.
    const separator = await page
      .locator('#segmented-sizing-md .cinder-segmented-control-option:nth-child(3)')
      .evaluate((element) => {
        const styles = getComputedStyle(element as HTMLElement, '::before');
        return {
          content: styles.content,
          borderInlineStartWidth: styles.borderInlineStartWidth || styles.borderLeftWidth,
        };
      });
    expect(separator.content).not.toBe('none');
    expect(Number.parseFloat(separator.borderInlineStartWidth)).toBeGreaterThan(0);
  });
});

test.describe('SegmentedControl — review-editor toolbar-nested tablist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REVIEW_EDITOR_ROUTE, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector(
      '.review-editor-controls .cinder-segmented-control[data-cinder-selection-mode="single"][data-cinder-variant="tablist"]',
      { state: 'visible' },
    );
  });

  test('arrow keys rove inside the nested tablist and wrap at both ends without escaping to the toolbar', async ({
    page,
  }) => {
    // The review-editor snapshot page may render more than one review-editor
    // instance (e.g. multiple examples on the page). Scope to the first
    // toolbar-nested view-switcher tablist; the roving contract is identical
    // across instances.
    const tablistSelector =
      '.review-editor-controls .cinder-segmented-control[data-cinder-selection-mode="single"][data-cinder-variant="tablist"]';
    const tablist = page.locator(tablistSelector).first();
    await expect(tablist).toBeVisible();

    const tab = (name: string) => tablist.getByRole('tab', { name });
    await expect(tab('Editor')).toBeVisible();
    await expect(tab('Diff')).toBeVisible();
    await expect(tab('Summary')).toBeVisible();

    // Focus the currently-selected tab (roving tabindex=0). The view switcher
    // initializes on "Editor".
    await tab('Editor').focus();
    await expect(tab('Editor')).toBeFocused();

    // Helper: assert focus + aria-selected both land on the named tab and that
    // focus is still inside the tablist (not stolen by a sibling toolbar
    // control such as the comments toggle).
    const expectActiveTab = async (name: string) => {
      await expect(tab(name)).toBeFocused();
      await expect(tab(name)).toHaveAttribute('aria-selected', 'true');
      const focusInside = await page.evaluate((selector) => {
        const root = document.querySelector(selector);
        return root instanceof HTMLElement && root.contains(document.activeElement);
      }, tablistSelector);
      expect(focusInside).toBe(true);
    };

    await page.keyboard.press('ArrowRight');
    await expectActiveTab('Diff');
    await page.keyboard.press('ArrowRight');
    await expectActiveTab('Summary');
    // ArrowRight from the last tab wraps to the first.
    await page.keyboard.press('ArrowRight');
    await expectActiveTab('Editor');
    // ArrowLeft from the first tab wraps to the last.
    await page.keyboard.press('ArrowLeft');
    await expectActiveTab('Summary');
  });
});
