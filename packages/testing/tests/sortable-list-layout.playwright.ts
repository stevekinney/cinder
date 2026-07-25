import { expect, test } from '@playwright/test';

const SORTABLE_LIST_ROUTE = '/page/sortable-list?snapshot=1';

test.describe('SortableList resting layout', () => {
  test('keeps each item label and trailing drag handle in one centered row', async ({ page }) => {
    await page.goto(SORTABLE_LIST_ROUTE, { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    const row = page.locator('[data-sortable-row]').filter({ hasText: 'Write release notes' });
    const label = row.getByText('Write release notes', { exact: true });
    const handle = row.getByRole('button', { name: 'Reorder Write release notes' });

    const [labelBox, handleBox] = await Promise.all([label.boundingBox(), handle.boundingBox()]);

    expect(labelBox).not.toBeNull();
    expect(handleBox).not.toBeNull();

    const labelCenterY = labelBox!.y + labelBox!.height / 2;
    const handleCenterY = handleBox!.y + handleBox!.height / 2;

    expect(Math.abs(labelCenterY - handleCenterY)).toBeLessThanOrEqual(0.5);
    expect(handleBox!.x).toBeGreaterThanOrEqual(labelBox!.x + labelBox!.width);
  });
});
