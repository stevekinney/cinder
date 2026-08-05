import type { Page } from '@playwright/test';

import { expect, test } from '../src/fixtures/component-page.ts';
import { loadManifest, VIEWPORTS } from '../src/helpers/manifest.ts';

const entriesBySlug = new Map(loadManifest().map((entry) => [entry.slug, entry] as const));
const lightTheme = 'light' as const;
const desktopViewport = VIEWPORTS.find((viewport) => viewport.name === 'desktop');
const mobileViewport = VIEWPORTS.find((viewport) => viewport.name === 'mobile');
if (!desktopViewport || !mobileViewport) {
  throw new Error('Manifest viewport presets are missing desktop/mobile entries.');
}

function getEntry(slug: string) {
  const entry = entriesBySlug.get(slug);
  if (!entry) throw new Error(`Component manifest is missing slug: ${slug}`);
  return entry;
}

/** Left offsets (rounded to whole pixels) of every direct item under the collapse target. */
async function itemLeftOffsets(page: Page, itemsSelector: string): Promise<number[]> {
  const items = page.locator(itemsSelector);
  const count = await items.count();
  const lefts: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const box = await items.nth(index).boundingBox();
    if (!box) throw new Error(`Missing bounding box for ${itemsSelector} #${index}`);
    lefts.push(Math.round(box.x));
  }
  return lefts;
}

/** Number of distinct left edges among the matched items, once their layout has settled. */
async function distinctLeftEdgeCount(page: Page, itemsSelector: string): Promise<number> {
  return new Set(await itemLeftOffsets(page, itemsSelector)).size;
}

test.describe('Grid / BentoGrid container-breakpoint collapse (#1186 row 10)', () => {
  test('Grid resets to a single column only once its own width crosses 48rem', async ({
    componentPage,
  }) => {
    const exampleRoot = '#example-mount-narrow-collapse';
    const itemsSelector = `${exampleRoot} .cinder-grid > div`;

    const page = await componentPage.open({
      entry: getEntry('grid'),
      theme: lightTheme,
      viewport: desktopViewport,
    });

    const grid = page.locator(`${exampleRoot} .cinder-grid`);
    await expect(grid).toBeVisible();
    await expect(grid).toHaveAttribute('data-cinder-collapse', '');

    const wideBox = await grid.boundingBox();
    expect(wideBox).not.toBeNull();
    expect(wideBox!.width).toBeGreaterThan(768);

    // Three columns lay the items out side-by-side: three distinct left edges.
    await expect.poll(() => distinctLeftEdgeCount(page, itemsSelector)).toBe(3);

    await page.setViewportSize({ width: mobileViewport.width, height: mobileViewport.height });

    await expect
      .poll(async () => {
        const box = await grid.boundingBox();
        return box?.width ?? Number.POSITIVE_INFINITY;
      })
      .toBeLessThanOrEqual(768);

    // A single column stacks every item at the same left edge. Poll rather
    // than reading once: the container's own box can settle a frame before
    // its children's grid placement does.
    await expect.poll(() => distinctLeftEdgeCount(page, itemsSelector)).toBe(1);
  });

  test('BentoGrid (composed on Grid) collapses its cells at the same container breakpoint', async ({
    componentPage,
  }) => {
    const exampleRoot = '#example-mount-basic';
    const cellsSelector = `${exampleRoot} .cinder-bento-cell`;

    const page = await componentPage.open({
      entry: getEntry('bento-grid'),
      theme: lightTheme,
      viewport: desktopViewport,
    });

    const grid = page.locator(`${exampleRoot} .cinder-bento-grid`);
    await expect(grid).toBeVisible();
    await expect(grid).toHaveAttribute('data-cinder-collapse', '');

    const wideBox = await grid.boundingBox();
    expect(wideBox).not.toBeNull();
    expect(wideBox!.width).toBeGreaterThan(768);

    // The bento mosaic places cells across more than one column at full width.
    await expect.poll(() => distinctLeftEdgeCount(page, cellsSelector)).toBeGreaterThan(1);

    await page.setViewportSize({ width: mobileViewport.width, height: mobileViewport.height });

    await expect
      .poll(async () => {
        const box = await grid.boundingBox();
        return box?.width ?? Number.POSITIVE_INFINITY;
      })
      .toBeLessThanOrEqual(768);

    // Collapsed to a single column: every cell shares the same left edge.
    // Poll rather than reading once: see note above.
    await expect.poll(() => distinctLeftEdgeCount(page, cellsSelector)).toBe(1);
  });
});
