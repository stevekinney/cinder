import { expect, test } from '@playwright/test';

test('screenshot the inspector', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'load' });
  await page.getByTestId('token-inspector-toggle').click();
  const panel = page.getByTestId('token-inspector-panel');
  await expect(panel).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/inspector-a.png' });

  await panel.getByLabel('Filter tokens').fill('accent');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/inspector-b.png' });
});
