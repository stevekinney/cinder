/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test';

import { runAxe, type AxeBuckets } from '../src/helpers/axe.ts';

const TREE_ROUTE = '/page/tree?snapshot=1';
const EXAMPLE = '#example-mount-reorder';

type LayoutBox = { x: number; y: number; width: number; height: number };

function axeViolations(buckets: AxeBuckets): unknown[] {
  return Object.values(buckets).flat();
}

function treeItemByLabel(page: Page, label: string): Locator {
  return page.locator(`${EXAMPLE} [role="treeitem"]:has(> .cinder-sr-only:text-is("${label}"))`);
}

function dragHandleOf(item: Locator): Locator {
  return item.locator('> .cinder-tree-item__row > .cinder-tree-item__drag-handle');
}

async function openReorderExample(page: Page): Promise<void> {
  await page.goto(TREE_ROUTE, { waitUntil: 'load' });
  await page.waitForSelector(`${EXAMPLE} [role="tree"]`, { state: 'visible' });
  await page.waitForFunction((selector) => {
    const tree = document.querySelector(`${selector} [role="tree"]`);
    return tree instanceof HTMLElement && tree.querySelectorAll('[role="treeitem"]').length >= 6;
  }, EXAMPLE);
  await page.locator(EXAMPLE).scrollIntoViewIfNeeded();
}

async function requiredBox(locator: Locator, name: string): Promise<LayoutBox> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, `${name} has a browser layout box`).not.toBeNull();
  return box as LayoutBox;
}

async function dragHandleToPoint(
  page: Page,
  handle: Locator,
  point: { x: number; y: number },
): Promise<void> {
  const handleBox = await requiredBox(handle, 'drag handle');
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 8 });
}

test.describe('Tree — drag-and-drop reorder', () => {
  test('pointer drag emits the target and keeps the reorder example accessible', async ({
    page,
  }) => {
    await openReorderExample(page);

    const alpha = treeItemByLabel(page, 'Alpha');
    const beta = treeItemByLabel(page, 'Beta');
    const alphaHandle = dragHandleOf(alpha);
    const lastDrop = page.locator(`${EXAMPLE} [data-testid="last-drop"]`);

    await expect(alphaHandle).toBeVisible();
    const alphaHandleBox = await requiredBox(alphaHandle, 'Alpha drag handle');
    const betaBox = await requiredBox(beta, 'Beta tree item');

    await page.mouse.move(
      alphaHandleBox.x + alphaHandleBox.width / 2,
      alphaHandleBox.y + alphaHandleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(betaBox.x + betaBox.width / 2, betaBox.y + betaBox.height - 2, {
      steps: 8,
    });
    await expect(beta).toHaveAttribute('data-cinder-drop-target', 'after');
    await page.mouse.up();

    await expect(lastDrop).toHaveText('alpha:after:beta');
    const buckets = await runAxe(
      page,
      { slug: 'tree', theme: 'light', viewport: 'desktop', fixture: 'reorder' },
      { include: EXAMPLE },
    );
    expect(axeViolations(buckets)).toEqual([]);
  });

  test('pointer drag covers before and child hit zones', async ({ page }) => {
    await openReorderExample(page);

    const beta = treeItemByLabel(page, 'Beta');
    const alphaHandle = dragHandleOf(treeItemByLabel(page, 'Alpha'));
    const lastDrop = page.locator(`${EXAMPLE} [data-testid="last-drop"]`);

    const betaBox = await requiredBox(beta, 'Beta tree item');
    await dragHandleToPoint(page, alphaHandle, {
      x: betaBox.x + betaBox.width / 2,
      y: betaBox.y + betaBox.height * 0.1,
    });
    await expect(beta).toHaveAttribute('data-cinder-drop-target', 'before');
    await page.mouse.up();
    await expect(lastDrop).toHaveText('alpha:before:beta');

    const nextBetaBox = await requiredBox(beta, 'Beta tree item after before drop');
    await dragHandleToPoint(page, alphaHandle, {
      x: nextBetaBox.x + nextBetaBox.width / 2,
      y: nextBetaBox.y + nextBetaBox.height / 2,
    });
    await expect(beta).toHaveAttribute('data-cinder-drop-into', '');
    await page.mouse.up();
    await expect(lastDrop).toHaveText('alpha:child:beta');
  });

  test('pointer drag autoscrolls when held near the tree edge', async ({ page }) => {
    await openReorderExample(page);

    const alphaHandle = dragHandleOf(treeItemByLabel(page, 'Alpha'));
    const tree = page.locator(`${EXAMPLE} [role="tree"]`);

    await tree.evaluate((element) => {
      element.scrollTop = 0;
    });
    const alphaHandleBox = await requiredBox(alphaHandle, 'Alpha drag handle');
    const treeBox = await requiredBox(tree, 'tree viewport');

    await page.mouse.move(
      alphaHandleBox.x + alphaHandleBox.width / 2,
      alphaHandleBox.y + alphaHandleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(treeBox.x + treeBox.width / 2, treeBox.y + treeBox.height - 4, {
      steps: 4,
    });

    await expect
      .poll(() => tree.evaluate((element) => element.scrollTop), {
        message: 'tree scrollTop advances while dragging near the bottom edge',
      })
      .toBeGreaterThan(0);

    await page.mouse.up();
  });
});
