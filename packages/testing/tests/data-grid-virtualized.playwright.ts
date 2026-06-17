import type { Page } from '@playwright/test';

import { expect, test } from '../src/fixtures/component-page.ts';
import { runAxe, type AxeBuckets } from '../src/helpers/axe.ts';
import { loadManifest } from '../src/helpers/manifest.ts';

const entriesBySlug = new Map(loadManifest().map((entry) => [entry.slug, entry] as const));
const desktopViewport = { name: 'desktop', width: 1280, height: 900 } as const;
const lightTheme = 'light' as const;
const virtualizedExample = '#example-mount-virtualized';
const rowHeight = 32;
const targetRowIndex = 25_000;

function getEntry(slug: string) {
  const entry = entriesBySlug.get(slug);
  if (!entry) throw new Error(`Component manifest is missing slug: ${slug}`);
  return entry;
}

function axeViolations(buckets: AxeBuckets): unknown[] {
  return Object.values(buckets).flat();
}

async function renderedRows(page: Page) {
  return page.locator(`${virtualizedExample} .cinder-data-grid__body [role="row"]`);
}

test.describe('DataGrid row virtualization', () => {
  test('real scroll keeps a 50k-row grid windowed with full ARIA metadata', async ({
    componentPage,
  }) => {
    const page = await componentPage.open({
      entry: getEntry('data-grid'),
      theme: lightTheme,
      viewport: desktopViewport,
      fixtureName: 'virtualized',
    });

    const grid = page.locator(`${virtualizedExample} [role="grid"]`);
    const rows = await renderedRows(page);

    await expect(grid).toBeVisible();
    await expect(grid).toHaveAttribute('aria-rowcount', '50001');
    await expect(grid).toHaveAttribute('aria-colcount', '4');
    await expect.poll(() => rows.count()).toBeGreaterThan(0);
    await expect.poll(() => rows.count()).toBeLessThan(80);

    const firstRenderMs = await page
      .waitForFunction(() => Reflect.get(window, '__cinderDataGridVirtualizedFirstRenderMs'), {
        timeout: 5_000,
      })
      .then((handle) => handle.jsonValue() as Promise<number>);
    console.info(`DataGrid virtualized first render: ${Math.round(firstRenderMs)}ms`);

    const scrollFrameMs = await page.evaluate(
      ({ selector, offset }) =>
        new Promise<number>((resolve) => {
          const gridElement = document.querySelector(`${selector} [role="grid"]`);
          if (!(gridElement instanceof HTMLElement)) {
            resolve(Number.POSITIVE_INFINITY);
            return;
          }
          const start = performance.now();
          gridElement.scrollTo({ top: offset });
          requestAnimationFrame(() => resolve(performance.now() - start));
        }),
      { selector: virtualizedExample, offset: targetRowIndex * rowHeight },
    );
    console.info(`DataGrid virtualized scroll frame: ${Math.round(scrollFrameMs)}ms`);

    await expect
      .poll(
        () =>
          rows.evaluateAll((items) =>
            items.map((item) => ({
              text: item.textContent ?? '',
              rowIndex: item.getAttribute('aria-rowindex'),
            })),
          ),
        { message: 'scrolling renders rows around index 25,000' },
      )
      .toContainEqual(
        expect.objectContaining({
          text: expect.stringContaining('Processed event 25,000'),
          rowIndex: '25002',
        }),
      );

    await expect.poll(() => rows.count()).toBeLessThan(80);

    await grid.focus();
    await page.keyboard.press('Control+End');
    await expect
      .poll(() => grid.getAttribute('aria-activedescendant'))
      .toContain('6c_6f_67_2d_34_39_39_39_39');

    const activeId = await grid.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    await expect(page.locator(`${virtualizedExample} [id="${activeId}"]`)).toHaveCount(1);

    const buckets = await runAxe(
      page,
      {
        slug: 'data-grid',
        theme: lightTheme,
        viewport: desktopViewport.name,
        fixture: 'virtualized',
      },
      { include: virtualizedExample },
    );
    expect(axeViolations(buckets)).toEqual([]);
  });
});
