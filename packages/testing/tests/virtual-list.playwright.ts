import type { Page } from '@playwright/test';

import { expect, test } from '../src/fixtures/component-page.ts';
import { runAxe, type AxeBuckets } from '../src/helpers/axe.ts';
import { loadManifest } from '../src/helpers/manifest.ts';

const entriesBySlug = new Map(loadManifest().map((entry) => [entry.slug, entry] as const));
const desktopViewport = { name: 'desktop', width: 1280, height: 900 } as const;
const lightTheme = 'light' as const;

function getEntry(slug: string) {
  const entry = entriesBySlug.get(slug);
  if (!entry) throw new Error(`Component manifest is missing slug: ${slug}`);
  return entry;
}

function axeViolations(buckets: AxeBuckets): unknown[] {
  return Object.values(buckets).flat();
}

test.describe('Virtualized list examples', () => {
  test('virtual-list keeps the 10k-row example windowed and axe-clean', async ({
    componentPage,
  }) => {
    const page = await componentPage.open({
      entry: getEntry('virtual-list'),
      theme: lightTheme,
      viewport: desktopViewport,
    });
    const mountSelector = '#example-mount-ten-thousand';
    const list = page.locator(`${mountSelector} .cinder-virtual-list`);
    const rows = page.locator(`${mountSelector} [data-cinder-virtual-index]`);

    await expect(list).toBeVisible();
    await expect.poll(() => rows.count()).toBeGreaterThan(0);
    await expect.poll(() => rows.count()).toBeLessThan(40);

    const buckets = await runAxe(
      page,
      {
        slug: 'virtual-list',
        theme: lightTheme,
        viewport: desktopViewport.name,
        fixture: 'ten-thousand',
      },
      { include: mountSelector },
    );
    expect(axeViolations(buckets)).toEqual([]);
  });

  test('data-table virtualized example keeps native table semantics and is axe-clean', async ({
    componentPage,
  }) => {
    const page = await componentPage.open({
      entry: getEntry('data-table'),
      theme: lightTheme,
      viewport: desktopViewport,
    });
    const mountSelector = '#example-mount-virtualized';
    const table = page.locator(`${mountSelector} table`);
    const bodyRows = page.locator(`${mountSelector} tbody tr:not([aria-hidden="true"])`);

    await expect(table).toBeVisible();
    await expect(table).toHaveAttribute('aria-rowcount', '10001');
    await expect(page.locator(`${mountSelector} thead th[scope="col"]`)).toHaveCount(4);
    await expect.poll(() => bodyRows.count()).toBeGreaterThan(0);
    await expect.poll(() => bodyRows.count()).toBeLessThan(40);

    const buckets = await runAxe(
      page,
      {
        slug: 'data-table',
        theme: lightTheme,
        viewport: desktopViewport.name,
        fixture: 'virtualized',
      },
      { include: mountSelector },
    );
    expect(axeViolations(buckets)).toEqual([]);
  });
});

/**
 * Horizontal and right-to-left windowing.
 *
 * These live here rather than in the component's unit tests because happy-dom has
 * no layout: `scrollWidth`/`clientWidth` are zero, `getComputedStyle().direction`
 * is always `'ltr'`, and the RTL `scrollLeft` conventions cannot be reproduced at
 * all. The inline axis is only observable in a real engine.
 */
test.describe('Virtual list - horizontal and RTL', () => {
  const columnWidth = 160;

  async function renderedIndices(page: Page, mountSelector: string): Promise<number[]> {
    return page
      .locator(`${mountSelector} [data-cinder-virtual-index]`)
      .evaluateAll((nodes) =>
        nodes.map((node) => Number(node.getAttribute('data-cinder-virtual-index'))),
      );
  }

  test('horizontal example scrolls the inline axis and windows from scrollLeft', async ({
    componentPage,
  }) => {
    const page = await componentPage.open({
      entry: getEntry('virtual-list'),
      theme: lightTheme,
      viewport: desktopViewport,
    });
    const mountSelector = '#example-mount-horizontal';
    const list = page.locator(`${mountSelector} .cinder-virtual-list`);

    await expect(list).toBeVisible();
    await expect(list).toHaveAttribute('data-cinder-orientation', 'horizontal');
    await expect
      .poll(async () => (await renderedIndices(page, mountSelector)).length)
      .toBeGreaterThan(0);

    // The container overflows along the inline axis and NOT the block axis. That is
    // what the orientation CSS is for; if the block axis overflowed instead, the
    // component would be windowing a dimension the user cannot scroll.
    const overflow = await list.evaluate((element) => ({
      inline: element.scrollWidth - element.clientWidth,
      block: element.scrollHeight - element.clientHeight,
    }));
    expect(overflow.inline).toBeGreaterThan(1_000);
    expect(overflow.block).toBeLessThanOrEqual(1);

    // Rows advance along the inline axis, so consecutive rows differ in x, not y.
    const firstTwo = await page
      .locator(`${mountSelector} [data-cinder-virtual-index]`)
      .evaluateAll((nodes) =>
        nodes.slice(0, 2).map((node) => {
          const rect = node.getBoundingClientRect();
          return { x: rect.x, y: rect.y };
        }),
      );
    expect(Math.abs(firstTwo[1]!.y - firstTwo[0]!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(firstTwo[1]!.x - firstTwo[0]!.x)).toBeGreaterThan(columnWidth / 2);

    // The viewport extent must be measured along the INLINE axis. The container's
    // block-size is `auto` under `horizontal`, so it collapses to roughly one row's
    // height — measuring that instead would under-report the viewport and render
    // too few columns to fill it, blanking the trailing edge on a fast scroll.
    const visibleColumns = await list.evaluate(
      (element, width) => Math.ceil(element.clientWidth / width),
      columnWidth,
    );
    expect(visibleColumns).toBeGreaterThan(1);
    await expect
      .poll(async () => (await renderedIndices(page, mountSelector)).length)
      .toBeGreaterThanOrEqual(visibleColumns);

    await list.evaluate((element, offset) => {
      element.scrollLeft = offset;
    }, columnWidth * 40);

    await expect.poll(() => renderedIndices(page, mountSelector)).toContain(40);
    expect(await renderedIndices(page, mountSelector)).not.toContain(0);
  });

  test('rtl example reads its scroll offset from the right edge', async ({ componentPage }) => {
    const page = await componentPage.open({
      entry: getEntry('virtual-list'),
      theme: lightTheme,
      viewport: desktopViewport,
    });
    const mountSelector = '#example-mount-horizontal-rtl';
    const list = page.locator(`${mountSelector} .cinder-virtual-list`);

    await expect(list).toBeVisible();
    await expect
      .poll(async () => (await renderedIndices(page, mountSelector)).length)
      .toBeGreaterThan(0);
    expect(await list.evaluate((element) => getComputedStyle(element).direction)).toBe('rtl');

    // At rest the list sits at its start edge, which in RTL is the RIGHT edge: index 0
    // is against the container's right side, not its left.
    const atRest = await list.evaluate((element) => {
      const container = element.getBoundingClientRect();
      const first = element.querySelector('[data-cinder-virtual-index="0"]');
      if (!first) return null;
      const row = first.getBoundingClientRect();
      return { fromRight: container.right - row.right, fromLeft: row.left - container.left };
    });
    expect(atRest).not.toBeNull();
    expect(Math.abs(atRest!.fromRight)).toBeLessThanOrEqual(2);
    expect(atRest!.fromLeft).toBeGreaterThan(columnWidth);

    // Derive the browser's RTL scrollLeft convention HERE, independently of the
    // component's own probe, then drive the scroll through it. If the component
    // detected a different convention than the browser actually implements, the raw
    // value below still lands 40 columns from the start edge while the component
    // reads some other offset - and this fails. Pinning a convention by name instead
    // of detecting it is exactly the regression this guards.
    const convention = await list.evaluate((element) => {
      const start = element.scrollLeft;
      element.scrollLeft = -1;
      const afterNegative = element.scrollLeft;
      element.scrollLeft = start;
      if (start > 0) return 'reverse';
      return afterNegative < 0 ? 'negative' : 'default';
    });

    await list.evaluate(
      (element, { offset, mode }) => {
        const max = element.scrollWidth - element.clientWidth;
        element.scrollLeft =
          mode === 'negative' ? -offset : mode === 'reverse' ? max - offset : offset;
      },
      { offset: columnWidth * 40, mode: convention },
    );

    await expect.poll(() => renderedIndices(page, mountSelector)).toContain(40);
    expect(await renderedIndices(page, mountSelector)).not.toContain(0);
  });

  test('rtl example is axe-clean', async ({ componentPage }) => {
    const page = await componentPage.open({
      entry: getEntry('virtual-list'),
      theme: lightTheme,
      viewport: desktopViewport,
    });
    const mountSelector = '#example-mount-horizontal-rtl';
    await expect(page.locator(`${mountSelector} .cinder-virtual-list`)).toBeVisible();

    const buckets = await runAxe(
      page,
      {
        slug: 'virtual-list',
        theme: lightTheme,
        viewport: desktopViewport.name,
        fixture: 'horizontal-rtl',
      },
      { include: mountSelector },
    );
    expect(axeViolations(buckets)).toEqual([]);
  });
});

test.describe('Sticky headers and keyboard navigation', () => {
  // Everything here needs a real browser. happy-dom computes no layout and no
  // cascade, so `position: sticky` never actually holds a row anywhere — which means
  // the whole model these keys are built on ("the header covers its own height at the
  // leading edge") is unfalsifiable in the unit suite. If the pinned row's rule lost
  // the cascade, or sticky resolved differently than assumed, every keyboard number
  // would be off by a header height and no unit test would notice.
  //
  // The example is 500 rows of 36px in sections of 25, so section headers sit at
  // indexes 0, 25, 50 … and row `n` starts at `36 * n`.
  const mountSelector = '#example-mount-sticky-headers';
  const rowHeight = 36;

  function listLocator(page: Page) {
    return page.locator(`${mountSelector} .cinder-virtual-list`);
  }

  async function offsetWithinList(page: Page, index: number): Promise<number> {
    const listBox = await listLocator(page).boundingBox();
    const rowBox = await page
      .locator(`${mountSelector} [data-cinder-virtual-index="${index}"]`)
      .boundingBox();
    if (listBox === null || rowBox === null) return Number.NaN;
    return Math.round(rowBox.y - listBox.y);
  }

  /**
   * Scrolls the list and waits for the COMPONENT to have caught up, not just the
   * browser.
   *
   * Setting `scrollTop` moves the container immediately, but the component learns
   * about it from a scroll event and re-derives its window a frame later. A key
   * pressed in between resolves its destination from the previous position — off by
   * exactly one row, which is a real race rather than a rounding artifact. It passed
   * on a fast machine and failed on CI, which is the shape of every test that waits
   * for a value it set itself.
   *
   * The probe is a row five below the leading edge: unlike the leading row, which a
   * sticky header holds at the top either way, its position can only be right once
   * the window has re-rendered for this offset.
   */
  async function scrollListTo(page: Page, offset: number): Promise<void> {
    const list = listLocator(page);
    await list.evaluate((element, value) => {
      element.scrollTop = value;
    }, offset);
    await expect
      .poll(async () => list.evaluate((element) => Math.round(element.scrollTop)))
      .toBe(offset);

    const probeIndex = Math.floor(offset / rowHeight) + 5;
    await expect(
      page.locator(`${mountSelector} [data-cinder-virtual-index="${probeIndex}"]`),
    ).toBeVisible();
    await expect
      .poll(async () => offsetWithinList(page, probeIndex))
      .toBe(probeIndex * rowHeight - offset);
  }

  async function pressAndSettle(page: Page, key: string, expected: number): Promise<void> {
    await listLocator(page).focus();
    await page.keyboard.press(key);
    await expect
      .poll(async () => listLocator(page).evaluate((element) => Math.round(element.scrollTop)))
      .toBe(expected);
  }

  test('holds a section header at the leading edge with real CSS', async ({ componentPage }) => {
    const page = await componentPage.open({
      entry: getEntry('virtual-list'),
      theme: lightTheme,
      viewport: desktopViewport,
    });
    await expect(listLocator(page)).toBeVisible();

    // Well into section 2, so header 50 is held rather than sitting at its own start.
    await scrollListTo(page, rowHeight * 60);

    // The header is painted at the container's own top edge, not at its position in
    // the scrolled content — which is what `position: sticky` is supposed to do and
    // what every keyboard offset in this component assumes.
    const header = page.locator(`${mountSelector} [data-cinder-virtual-index="50"]`);
    await expect(header).toBeVisible();
    await expect.poll(async () => offsetWithinList(page, 50)).toBe(0);
    expect(Math.round((await header.boundingBox())?.height ?? 0)).toBe(rowHeight);
  });

  test('lands an arrow destination below the header rather than under it', async ({
    componentPage,
  }) => {
    const page = await componentPage.open({
      entry: getEntry('virtual-list'),
      theme: lightTheme,
      viewport: desktopViewport,
    });
    await expect(listLocator(page)).toBeVisible();

    // Parked exactly where section 2 begins — the offset every step onto a section
    // lands on, and where the header is both the first visible row and the thing
    // covering the leading edge.
    await scrollListTo(page, rowHeight * 50);
    await pressAndSettle(page, 'ArrowDown', rowHeight * 51);

    // Row 52 is the destination — the step passes over header 50 — and it sits
    // immediately below the pinned header rather than beneath it.
    await expect(page.locator(`${mountSelector} [data-cinder-virtual-index="52"]`)).toBeVisible();
    await expect.poll(async () => offsetWithinList(page, 52)).toBe(rowHeight);
  });

  test('moves in both directions from a section boundary', async ({ componentPage }) => {
    const page = await componentPage.open({
      entry: getEntry('virtual-list'),
      theme: lightTheme,
      viewport: desktopViewport,
    });
    await expect(listLocator(page)).toBeVisible();

    // Neither direction may stall: the header is the first visible row AND the
    // leading-edge occupant, and resolving that wrongly leaves one key dead.
    for (const [key, expected] of [
      ['ArrowDown', rowHeight * 51],
      ['ArrowUp', rowHeight * 48],
    ] as const) {
      await scrollListTo(page, rowHeight * 50);
      await pressAndSettle(page, key, expected);
    }
  });

  test('pages by the rows the header leaves visible', async ({ componentPage }) => {
    const page = await componentPage.open({
      entry: getEntry('virtual-list'),
      theme: lightTheme,
      viewport: desktopViewport,
    });
    await expect(listLocator(page)).toBeVisible();

    await scrollListTo(page, rowHeight * 50);

    // A 360px viewport over 36px rows fits ten, but the header covers one, so nine
    // are exposed: from row 51 the page reaches row 60, landing it below the header.
    await pressAndSettle(page, 'PageDown', rowHeight * 59);

    await expect(page.locator(`${mountSelector} [data-cinder-virtual-index="60"]`)).toBeVisible();
    await expect.poll(async () => offsetWithinList(page, 60)).toBe(rowHeight);
  });
});
