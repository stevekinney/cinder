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
