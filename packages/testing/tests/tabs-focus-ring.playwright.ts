/// <reference lib="dom" />
/**
 * Regression test for ticket 8d636e92 — "Tabs: clipped focus-visible ring in
 * the tab list."
 *
 * The tab list (`.cinder-tab-list`) sets `overflow-x: auto`. Per the CSS
 * Overflow spec, a non-`visible` value on one axis forces the other axis's
 * used `overflow` to `auto` too, so the list clips on BOTH axes. The previous
 * focus ring was the standard OUTSET Strategy-B ring (offset + ring width
 * painted ~4px OUTSIDE the tab border box); since the list has zero block
 * padding, that ring poked past the list's content box on the top/bottom/
 * trailing edges and was clipped — only the first tab's inline-start edge
 * survived (the reported "teal ring on the top-left only" symptom).
 *
 * The fix converts the tab to the policy-sanctioned Strategy B-inset variant:
 * an INSET single-band ring painted entirely WITHIN the tab border box, so the
 * overflow clamp can never clip it in either orientation.
 *
 * This spec drives the component with REAL KEYBOARD NAVIGATION (a programmatic
 * `.focus()` does NOT engage `:focus-visible` in Chromium) and then measures
 * the painted ring geometry to prove it is complete and unclipped:
 *
 *   1. Tab-walk from `document.body` until the target tab is `activeElement`.
 *   2. Assert `element.matches(':focus-visible') === true`.
 *   3. Assert the inset ring's painted box (the tab border box itself, since
 *      the ring is inset) sits fully inside the tab list's client rect on all
 *      four sides — so no edge is clipped.
 *   4. Assert the computed `box-shadow` is `inset` and carries the resolved
 *      `--cinder-ring-color`.
 *   5. Selected ≠ focused: the focused tab still renders its active-stripe
 *      `::after` (accent background), so the two states stay distinguishable.
 *   6. Disabled tabs are unreachable by keyboard and carry no ring.
 *   7. Repeat the unclipped-ring proof for a VERTICAL tab list.
 *
 * Pre-fix, the outset ring's outer box (the tab rect grown by ~4px) overflows
 * the list rect by ~3-4px on the top/bottom, so the all-sides-inside assertion
 * fails and the computed box-shadow carries no `inset` keyword.
 */

import { expect, test, type Page } from '@playwright/test';

const TABS_ROUTE = '/page/tabs?snapshot=1';

// Box metrics come back as fractional pixels; allow a sub-pixel slack so a
// ring that sits exactly on the list edge isn't flagged as clipped.
const EDGE_TOLERANCE = 0.5;

// The `with-keyboard` example renders a horizontal tablist labelled
// "Workflow stages" with a disabled "Ship" tab; the `vertical` example renders
// the same shape with orientation="vertical" labelled "Workflow stages
// (vertical)". Both are mounted on /page/tabs.
const HORIZONTAL_LIST = '.cinder-tab-list[aria-label="Workflow stages"]';
const VERTICAL_LIST = '.cinder-tab-list[aria-label="Workflow stages (vertical)"]';

type RingMetrics = {
  matchesFocusVisible: boolean;
  boxShadow: string;
  tab: { top: number; bottom: number; left: number; right: number };
  list: { top: number; bottom: number; left: number; right: number };
  // The maximum distance the focus ring is painted OUTSIDE the tab border box.
  // For an INSET ring this is 0 (the ring paints inward); for the previous
  // OUTSET ring it is offset(1px) + ring-width(3px) = ~4px. Computed from the
  // live computed box-shadow so the geometry proof is recipe-agnostic and the
  // pre-fix outset ring (which pokes past the zero-padding list) fails the
  // all-sides-inside assertion directly.
  ringOutsetPx: number;
  resolvedRingColor: string;
};

/**
 * Resolve `--cinder-ring-color` to the browser-computed rgb()/oklch() string
 * by painting it onto a probe element, so the box-shadow color comparison has
 * browser-normalized values on both sides.
 */
async function resolvedRingColor(page: Page, withinSelector: string): Promise<string> {
  return page.evaluate((selector) => {
    const anchor = document.querySelector(selector);
    if (!(anchor instanceof HTMLElement)) {
      throw new Error(`No element matched ${selector} for ring-color resolution`);
    }
    const token = getComputedStyle(anchor).getPropertyValue('--cinder-ring-color').trim();
    const probe = document.createElement('span');
    probe.style.color = token;
    document.body.append(probe);
    try {
      return getComputedStyle(probe).color;
    } finally {
      probe.remove();
    }
  }, withinSelector);
}

/**
 * Walk Tab from `document.body` (capped) until the tab matching `tabName`
 * inside `listSelector` is the active element, then return its ring metrics.
 */
async function tabWalkToTab(
  page: Page,
  listSelector: string,
  tabName: string,
): Promise<RingMetrics> {
  // Reset focus to the body so the Tab walk is deterministic.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.focus();
  });

  const isLanded = () =>
    page.evaluate(
      ({ selector, name }) => {
        const list = document.querySelector(selector);
        if (!list) return false;
        const active = document.activeElement;
        return (
          active instanceof HTMLElement &&
          active.classList.contains('cinder-tab') &&
          list.contains(active) &&
          active.textContent?.trim() === name
        );
      },
      { selector: listSelector, name: tabName },
    );

  let landed = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.keyboard.press('Tab');
    if (await isLanded()) {
      landed = true;
      break;
    }
  }
  expect(landed, `Tab walk never reached "${tabName}" in ${listSelector}`).toBe(true);

  return page.evaluate(
    ({ selector }) => {
      const list = document.querySelector(selector);
      if (!(list instanceof HTMLElement)) throw new Error(`No list ${selector}`);
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) throw new Error('No active element');

      const tabRect = active.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const styles = getComputedStyle(active);

      const ringToken = styles.getPropertyValue('--cinder-ring-color').trim();
      const probe = document.createElement('span');
      probe.style.color = ringToken;
      document.body.append(probe);
      let resolvedRingColor: string;
      try {
        resolvedRingColor = getComputedStyle(probe).color;
      } finally {
        probe.remove();
      }

      // Largest OUTWARD extent of the computed box-shadow. Each comma-separated
      // layer is `<color> <offsetX> <offsetY> <blur> <spread>` with an optional
      // `inset` keyword. Inset layers paint inward → 0. For an outset layer the
      // outward extent is `spread + max(|offsetX|, |offsetY|)` (a symmetric ring
      // has zero offset, so this is the spread). The split keeps rgb()/oklch()
      // commas intact via the unclosed-paren lookahead.
      const boxShadow = styles.boxShadow;
      let ringOutsetPx = 0;
      if (boxShadow && boxShadow !== 'none') {
        for (const layer of boxShadow.split(/,(?![^(]*\))/)) {
          if (/\binset\b/.test(layer)) continue;
          const lengths = [...layer.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) =>
            Number.parseFloat(match[1]!),
          );
          if (lengths.length < 2) continue;
          const offsetX = lengths[0] ?? 0;
          const offsetY = lengths[1] ?? 0;
          const spread = lengths[3] ?? 0;
          const outset = spread + Math.max(Math.abs(offsetX), Math.abs(offsetY));
          if (outset > ringOutsetPx) ringOutsetPx = outset;
        }
      }

      return {
        matchesFocusVisible: active.matches(':focus-visible'),
        boxShadow,
        tab: {
          top: tabRect.top,
          bottom: tabRect.bottom,
          left: tabRect.left,
          right: tabRect.right,
        },
        list: {
          top: listRect.top,
          bottom: listRect.bottom,
          left: listRect.left,
          right: listRect.right,
        },
        ringOutsetPx,
        resolvedRingColor,
      };
    },
    { selector: listSelector },
  );
}

/**
 * Prove the focus ring is painted complete and unclipped: grow the tab border
 * box outward by the ring's measured outward extent (the PAINTED ring rect),
 * then assert that rect sits fully inside the list's clipping rect on all four
 * sides. For the inset ring the outset is 0, so the painted rect is the border
 * box (which fits). For the previous OUTSET ring the painted rect is the border
 * box grown ~4px on every edge; the list has zero block padding, so the grown
 * rect pokes ~3px past the list top/bottom and this assertion FAILS — exactly
 * the clipping bug the ticket reports.
 */
function assertRingUnclipped(metrics: RingMetrics, label: string): void {
  const outset = metrics.ringOutsetPx;
  expect(
    metrics.tab.top - outset,
    `${label}: painted ring top inside list top`,
  ).toBeGreaterThanOrEqual(metrics.list.top - EDGE_TOLERANCE);
  expect(
    metrics.tab.bottom + outset,
    `${label}: painted ring bottom inside list bottom`,
  ).toBeLessThanOrEqual(metrics.list.bottom + EDGE_TOLERANCE);
  expect(
    metrics.tab.left - outset,
    `${label}: painted ring left inside list left`,
  ).toBeGreaterThanOrEqual(metrics.list.left - EDGE_TOLERANCE);
  expect(
    metrics.tab.right + outset,
    `${label}: painted ring right inside list right`,
  ).toBeLessThanOrEqual(metrics.list.right + EDGE_TOLERANCE);
}

test.describe('Tabs — focus-visible ring is complete and unclipped in the tab list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TABS_ROUTE, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector(`${HORIZONTAL_LIST} .cinder-tab`, { state: 'visible' });
    await page.waitForSelector(`${VERTICAL_LIST} .cinder-tab`, { state: 'visible' });
    // Layout must be settled (non-zero box) before metric reads.
    await page.waitForFunction((selector) => {
      const tab = document.querySelector(`${selector} .cinder-tab`);
      return tab instanceof HTMLElement && tab.getBoundingClientRect().height > 0;
    }, HORIZONTAL_LIST);
  });

  test('HORIZONTAL: keyboard-focused tab paints an inset ring that is not clipped on any side', async ({
    page,
  }) => {
    const ringColor = await resolvedRingColor(page, HORIZONTAL_LIST);
    // The horizontal example initializes value="design", so "Design" is the
    // roving tabindex=0 stop the first Tab into the list lands on.
    const metrics = await tabWalkToTab(page, HORIZONTAL_LIST, 'Design');

    // Real keyboard focus engaged :focus-visible (the pseudo the ring keys off).
    expect(metrics.matchesFocusVisible).toBe(true);

    // The ring is INSET: its painted box is the tab border box, which must sit
    // fully inside the list's overflow clip on all four sides. (Pre-fix the
    // outset ring's painted rect — border box grown ~4px — pokes past the
    // zero-padding list and this fails.)
    assertRingUnclipped(metrics, 'horizontal Design tab');

    // Inset ring paints zero pixels outward — the load-bearing geometry fact.
    expect(metrics.ringOutsetPx).toBe(0);

    // The box-shadow is the inset ring (not the clipped outset recipe) and
    // carries the resolved ring color.
    expect(metrics.boxShadow).toContain('inset');
    expect(metrics.boxShadow).toContain(metrics.resolvedRingColor);
    expect(metrics.resolvedRingColor).toBe(ringColor);
  });

  test('SELECTED ≠ FOCUSED: the focused selected tab still shows the accent active stripe', async ({
    page,
  }) => {
    // "Design" is both the selected tab (value="design") and the keyboard
    // focus target, so it carries the focus ring AND the active stripe — the
    // two states must remain simultaneously distinguishable.
    await tabWalkToTab(page, HORIZONTAL_LIST, 'Design');

    const stripe = await page.evaluate((selector) => {
      const list = document.querySelector(selector);
      if (!list) throw new Error('no list');
      const active = list.querySelector('.cinder-tab[data-cinder-active]');
      if (!(active instanceof HTMLElement)) throw new Error('no active tab');
      const after = getComputedStyle(active, '::after');
      const accentToken = getComputedStyle(active).getPropertyValue('--cinder-accent').trim();
      const probe = document.createElement('span');
      probe.style.color = accentToken;
      document.body.append(probe);
      let resolvedAccent: string;
      try {
        resolvedAccent = getComputedStyle(probe).color;
      } finally {
        probe.remove();
      }
      return {
        content: after.content,
        background: after.backgroundColor,
        isFocused: active === document.activeElement,
        matchesFocusVisible: active.matches(':focus-visible'),
        resolvedAccent,
      };
    }, HORIZONTAL_LIST);

    // The active stripe pseudo-element exists (not removed) and is accent-toned.
    expect(stripe.content).not.toBe('none');
    expect(stripe.background).toBe(stripe.resolvedAccent);
    // And the same tab is genuinely keyboard-focused (so ring + stripe coexist).
    expect(stripe.isFocused).toBe(true);
    expect(stripe.matchesFocusVisible).toBe(true);
  });

  test('DISABLED: the Ship tab is unreachable by keyboard and carries no focus ring', async ({
    page,
  }) => {
    const shipState = await page.evaluate((selector) => {
      const list = document.querySelector(selector);
      if (!list) throw new Error('no list');
      const tabs = Array.from(list.querySelectorAll('.cinder-tab'));
      const ship = tabs.find((tab) => tab.textContent?.trim() === 'Ship');
      if (!(ship instanceof HTMLButtonElement)) throw new Error('no Ship tab');
      return {
        hasDisabledAttr: ship.hasAttribute('disabled'),
        tabIndex: ship.getAttribute('tabindex'),
        boxShadow: getComputedStyle(ship).boxShadow,
      };
    }, HORIZONTAL_LIST);

    // Disabled tab carries the native disabled attribute and is removed from
    // the tab order (roving tabindex = -1).
    expect(shipState.hasDisabledAttr).toBe(true);
    expect(shipState.tabIndex).toBe('-1');
    // Not focused → no focus ring.
    expect(shipState.boxShadow).toBe('none');

    // Walk the entire focusable set; the Ship tab must never become active.
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      document.body.focus();
    });
    let shipEverFocused = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await page.keyboard.press('Tab');
      const isShip = await page.evaluate((selector) => {
        const list = document.querySelector(selector);
        const active = document.activeElement;
        return (
          !!list &&
          active instanceof HTMLElement &&
          list.contains(active) &&
          active.textContent?.trim() === 'Ship'
        );
      }, HORIZONTAL_LIST);
      if (isShip) {
        shipEverFocused = true;
        break;
      }
    }
    expect(shipEverFocused, 'disabled Ship tab must never receive keyboard focus').toBe(false);
  });

  test('VERTICAL: keyboard-focused tab paints an inset ring that is not clipped on any side', async ({
    page,
  }) => {
    const ringColor = await resolvedRingColor(page, VERTICAL_LIST);
    const metrics = await tabWalkToTab(page, VERTICAL_LIST, 'Design');

    expect(metrics.matchesFocusVisible).toBe(true);
    // Cross-axis is inline here; the inset-ring proof is orientation-agnostic —
    // the painted ring rect must be inside the vertical list's clip on all sides.
    assertRingUnclipped(metrics, 'vertical Design tab');
    expect(metrics.ringOutsetPx).toBe(0);
    expect(metrics.boxShadow).toContain('inset');
    expect(metrics.boxShadow).toContain(metrics.resolvedRingColor);
    expect(metrics.resolvedRingColor).toBe(ringColor);
  });
});

/**
 * Regression test for #402 — "Active tab font-weight shift causes sibling tabs
 * to jump laterally on selection."
 *
 * The fix moves `font-weight: var(--cinder-font-medium)` from the
 * `.cinder-tab[data-cinder-active]` rule to the base `.cinder-tab` rule, so the
 * weight is constant and activation no longer reflows the row. A unit test can
 * only assert the CSS shape (happy-dom does no layout); this spec proves the
 * BEHAVIOUR in a real browser by measuring an inactive sibling tab's
 * `offsetWidth` before and after a different tab is activated and asserting it
 * does not change.
 *
 * Pre-fix, activating a sibling promoted that tab to weight 500, which widened
 * it and pushed the row — the measured inactive tab's `offsetWidth` shifted by
 * 1-3px and this assertion fails.
 */
test.describe('Tabs — activating a tab does not reflow sibling widths (regression #402)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TABS_ROUTE, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector(`${HORIZONTAL_LIST} .cinder-tab`, { state: 'visible' });
    await page.waitForFunction((selector) => {
      const tab = document.querySelector(`${selector} .cinder-tab`);
      return tab instanceof HTMLElement && tab.getBoundingClientRect().width > 0;
    }, HORIZONTAL_LIST);
  });

  test('an inactive sibling tab keeps its offsetWidth when another tab is activated', async ({
    page,
  }) => {
    // Read every tab's label + offsetWidth, plus which tab is currently active.
    const readTabs = () =>
      page.evaluate((selector) => {
        const list = document.querySelector(selector);
        if (!(list instanceof HTMLElement)) throw new Error(`No list ${selector}`);
        const tabs = Array.from(list.querySelectorAll('.cinder-tab')).filter(
          (tab): tab is HTMLElement => tab instanceof HTMLElement,
        );
        return tabs.map((tab) => ({
          label: tab.textContent?.trim() ?? '',
          width: tab.offsetWidth,
          active: tab.getAttribute('data-cinder-active') !== null,
          disabled: tab.hasAttribute('disabled') || tab.getAttribute('aria-disabled') === 'true',
        }));
      }, HORIZONTAL_LIST);

    const before = await readTabs();
    expect(before.length, 'expected multiple tabs to measure').toBeGreaterThan(1);

    // Pick an INACTIVE, enabled tab to watch, and a DIFFERENT enabled tab to activate.
    const watched = before.find((tab) => !tab.active && !tab.disabled);
    const toActivate = before.find(
      (tab) => !tab.disabled && tab.label !== watched?.label && !tab.active,
    );
    expect(watched, 'need an inactive enabled tab to watch').toBeTruthy();
    expect(toActivate, 'need a second enabled tab to activate').toBeTruthy();

    // Activate the other tab by clicking it (selection, not just focus). Scope
    // the locator to the horizontal list: /page/tabs mounts a second (vertical)
    // tab list that reuses the same labels, so a page-global getByRole('tab')
    // resolves to two elements and trips Playwright strict mode.
    await page
      .locator(HORIZONTAL_LIST)
      .getByRole('tab', { name: toActivate!.label, exact: true })
      .click();
    await page.waitForFunction(
      ({ selector, label }) => {
        const list = document.querySelector(selector);
        if (!(list instanceof HTMLElement)) return false;
        const active = list.querySelector('.cinder-tab[data-cinder-active]');
        return active instanceof HTMLElement && active.textContent?.trim() === label;
      },
      { selector: HORIZONTAL_LIST, label: toActivate!.label },
    );

    const after = await readTabs();
    const watchedAfter = after.find((tab) => tab.label === watched!.label);
    expect(watchedAfter, 'watched tab disappeared after activation').toBeTruthy();

    // The load-bearing assertion: the watched inactive tab's width must be
    // unchanged. Pre-fix, the newly-active sibling widened and reflowed the row,
    // shifting this width by 1-3px.
    expect(
      watchedAfter!.width,
      `inactive tab "${watched!.label}" offsetWidth changed on sibling activation (jank)`,
    ).toBe(watched!.width);
  });
});
