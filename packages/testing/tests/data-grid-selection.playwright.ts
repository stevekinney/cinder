import type { Page } from '@playwright/test';

import { expect, test } from '../src/fixtures/component-page.ts';
import { runAxe, type AxeBuckets } from '../src/helpers/axe.ts';
import { loadManifest } from '../src/helpers/manifest.ts';

const entriesBySlug = new Map(loadManifest().map((entry) => [entry.slug, entry] as const));
const desktopViewport = { name: 'desktop', width: 1280, height: 900 } as const;
const lightTheme = 'light' as const;
const ordersExample = '#example-mount-orders';

function getEntry(slug: string) {
  const entry = entriesBySlug.get(slug);
  if (!entry) throw new Error(`Component manifest is missing slug: ${slug}`);
  return entry;
}

function axeViolations(buckets: AxeBuckets): unknown[] {
  return Object.values(buckets).flat();
}

function cellAt(page: Page, rowIndex: number, columnIndex: number) {
  return page
    .locator(`${ordersExample} [role="row"][aria-rowindex="${rowIndex + 2}"] [role="gridcell"]`)
    .nth(columnIndex);
}

async function expectActiveCell(page: Page, rowIndex: number, columnIndex: number): Promise<void> {
  const grid = page.locator(`${ordersExample} [role="grid"]`);
  const cell = cellAt(page, rowIndex, columnIndex);
  const cellId = await cell.getAttribute('id');

  expect(cellId).toBeTruthy();
  await expect(grid).toHaveAttribute('aria-activedescendant', cellId!);
  await expect(cell).toHaveAttribute('data-cinder-active', 'true');
}

test.describe('DataGrid selection keyboard behavior', () => {
  test('supports range selection, spreadsheet navigation, copy, and axe-clean selected state', async ({
    componentPage,
  }) => {
    const page = await componentPage.open({
      entry: getEntry('data-grid'),
      theme: lightTheme,
      viewport: desktopViewport,
      fixtureName: 'orders',
    });

    const grid = page.locator(`${ordersExample} [role="grid"]`);
    const selectedCells = page.locator(`${ordersExample} [role="gridcell"][aria-selected="true"]`);

    await expect(grid).toBeVisible();
    await expect(page.locator(`${ordersExample} [role="gridcell"]`)).toHaveCount(20);

    await grid.focus();
    await expect(grid).toBeFocused();
    await expectActiveCell(page, 0, 0);

    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');

    await expectActiveCell(page, 1, 1);
    await expect(selectedCells).toHaveCount(4);
    await expect(grid).toHaveAttribute('aria-multiselectable', 'true');
    await expect(
      page.locator(`${ordersExample} [role="gridcell"][data-cinder-anchor]`),
    ).toHaveCount(1);

    const buckets = await runAxe(
      page,
      { slug: 'data-grid', theme: lightTheme, viewport: desktopViewport.name, fixture: 'orders' },
      { include: ordersExample },
    );
    expect(axeViolations(buckets)).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(selectedCells).toHaveCount(1);

    await page.keyboard.press('End');
    await expectActiveCell(page, 1, 4);

    await page.keyboard.press('Tab');
    await expectActiveCell(page, 2, 0);

    await page.keyboard.press('Control+Home');
    await expectActiveCell(page, 0, 0);

    await page.keyboard.press('Control+End');
    await expectActiveCell(page, 3, 4);

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText(text: string) {
            Reflect.set(window, '__cinderDataGridCopiedText', text);
            return Promise.resolve();
          },
        },
      });
    });

    await page.keyboard.press('Control+A');
    await expect(selectedCells).toHaveCount(20);

    await page.keyboard.press('Control+C');
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, '__cinderDataGridCopiedText')))
      .toBe(
        'ORD-1001\tAda Lovelace\tPacked\t$124\tToday\n' +
          'ORD-1002\tGrace Hopper\tShipped\t$256\tYesterday\n' +
          'ORD-1003\tAlan Turing\tQueued\t$88\tMonday\n' +
          'ORD-1004\tMargaret Hamilton\tDelivered\t$318\tFriday',
      );
  });
});
