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

async function renderedCells(page: Page) {
  return page.locator(`${virtualizedExample} .cinder-data-grid__body [role="gridcell"]`);
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
    const cells = await renderedCells(page);

    await expect(grid).toBeVisible();
    await expect(grid).toHaveAttribute('aria-rowcount', '50001');
    await expect(grid).toHaveAttribute('aria-colcount', '13');
    await expect.poll(() => rows.count()).toBeGreaterThan(0);
    await expect.poll(() => rows.count()).toBeLessThan(80);
    await expect.poll(() => cells.count()).toBeLessThan(13 * 80);

    const timestampCell = page
      .locator(`${virtualizedExample} [role="gridcell"][data-cinder-column-key="timestamp"]`)
      .first();
    const messageCell = page
      .locator(`${virtualizedExample} [role="gridcell"][data-cinder-column-key="message"]`)
      .first();
    await expect(timestampCell).toHaveAttribute('data-cinder-pin', 'left');
    await expect(messageCell).toHaveAttribute('data-cinder-pin', 'right');
    await expect(timestampCell).toHaveAttribute('aria-colindex', '1');
    await expect(messageCell).toHaveAttribute('aria-colindex', '13');

    await expect
      .poll(() =>
        timestampCell.evaluate((cell) => {
          const style = getComputedStyle(cell);
          return {
            position: style.position,
            insetInlineStart: style.insetInlineStart,
          };
        }),
      )
      .toEqual({ position: 'sticky', insetInlineStart: '0px' });

    await page.waitForFunction(
      () => Object.hasOwn(window, '__cinderDataGridVirtualizedFirstRenderMs'),
      {
        timeout: 5_000,
      },
    );
    const firstRenderMs = await page.evaluate(() =>
      Reflect.get(window, '__cinderDataGridVirtualizedFirstRenderMs'),
    );
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

    const horizontalScrollFrameMs = await page.evaluate(
      ({ selector }) =>
        new Promise<number>((resolve) => {
          const gridElement = document.querySelector(`${selector} [role="grid"]`);
          if (!(gridElement instanceof HTMLElement)) {
            resolve(Number.POSITIVE_INFINITY);
            return;
          }
          const start = performance.now();
          gridElement.scrollTo({ left: 900 });
          requestAnimationFrame(() => resolve(performance.now() - start));
        }),
      { selector: virtualizedExample },
    );
    console.info(
      `DataGrid virtualized horizontal scroll frame: ${Math.round(horizontalScrollFrameMs)}ms`,
    );

    await expect
      .poll(() =>
        cells.evaluateAll((items) =>
          items.map((item) => ({
            columnKey: (item as HTMLElement).dataset['cinderColumnKey'],
            columnIndex: item.getAttribute('aria-colindex'),
          })),
        ),
      )
      .toContainEqual({ columnKey: 'tenant', columnIndex: '9' });
    await expect(timestampCell).toHaveAttribute('data-cinder-pin', 'left');
    await expect(messageCell).toHaveAttribute('data-cinder-pin', 'right');

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
      .poll(async () => {
        const activeId = await grid.getAttribute('aria-activedescendant');
        if (!activeId) return null;

        return page
          .locator(`${virtualizedExample} [id="${activeId}"]`)
          .locator('xpath=ancestor::*[@role="row"][1]')
          .getAttribute('aria-rowindex');
      })
      .toBe('50001');

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
