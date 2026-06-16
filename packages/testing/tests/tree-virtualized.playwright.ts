/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';

import { runAxe, type AxeBuckets } from '../src/helpers/axe.ts';

const TREE_ROUTE = '/page/tree?snapshot=1';
const EXAMPLE = '#example-mount-virtualized';

function axeViolations(buckets: AxeBuckets): unknown[] {
  return Object.values(buckets).flat();
}

async function openVirtualizedExample(page: Page): Promise<void> {
  await page.goto(TREE_ROUTE, { waitUntil: 'load' });
  await page.waitForSelector(`${EXAMPLE} [role="tree"]`, { state: 'visible' });
  await page.waitForFunction((selector) => {
    const tree = document.querySelector(`${selector} [role="tree"]`);
    return tree instanceof HTMLElement && tree.querySelectorAll('[role="treeitem"]').length >= 10;
  }, EXAMPLE);
  await page.locator(EXAMPLE).scrollIntoViewIfNeeded();
}

test.describe('Tree — virtualized data path', () => {
  test('real scroll keeps rows windowed with full aria metadata and a valid active descendant', async ({
    page,
  }) => {
    await openVirtualizedExample(page);

    const tree = page.locator(`${EXAMPLE} [role="tree"]`);
    const rows = page.locator(`${EXAMPLE} [role="treeitem"]`);

    await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(10);
    await expect.poll(() => rows.count()).toBeLessThan(200);
    await expect(rows.first()).toHaveAttribute('aria-setsize', '10000');

    const rowHeight = await rows.first().evaluate((row) => row.getBoundingClientRect().height);
    expect(rowHeight).toBeGreaterThan(0);
    await tree.evaluate((element, measuredRowHeight) => {
      element.scrollTo({ top: 5_000 * measuredRowHeight });
    }, rowHeight);

    await expect
      .poll(
        () =>
          rows.evaluateAll((items) =>
            items.map((item) => (item as HTMLElement).dataset['cinderTreeItemId'] ?? ''),
          ),
        { message: 'scrolling renders the row around index 5000' },
      )
      .toContain('virtual-file-5000');

    const target = page.locator(`${EXAMPLE} [data-cinder-tree-item-id="virtual-file-5000"]`);
    await expect(target).toHaveAttribute('aria-posinset', '5001');
    await expect(target).toHaveAttribute('aria-setsize', '10000');
    await expect.poll(() => rows.count()).toBeLessThan(200);

    const activeId = await tree.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    await expect(page.locator(`${EXAMPLE} [id="${activeId}"]`)).toHaveCount(1);

    const buckets = await runAxe(
      page,
      { slug: 'tree', theme: 'light', viewport: 'desktop', fixture: 'virtualized' },
      { include: EXAMPLE },
    );
    expect(axeViolations(buckets)).toEqual([]);
  });
});
