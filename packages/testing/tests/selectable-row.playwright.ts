import { expect, test } from '@playwright/test';

test.describe('SelectableRow native interaction contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/page/selectable-row?snapshot=1', { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
  });

  test('pointer and native keyboard activation target only the primary action', async ({
    page,
  }) => {
    const primary = page.getByRole('button', { name: /customer onboarding workflow/i });
    const rename = page.getByRole('button', { name: 'Rename' });
    const counts = page.getByTestId('selectable-row-activation-counts');

    await primary.click();
    await expect(counts).toHaveText('Opened 1 times; renamed 0 times.');

    await primary.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(counts).toHaveText('Opened 3 times; renamed 0 times.');

    await rename.click();
    await expect(counts).toHaveText('Opened 3 times; renamed 1 times.');
  });

  test('Tab follows primary, rename, and external-link DOM order', async ({ page }) => {
    const primary = page.getByRole('button', { name: /customer onboarding workflow/i });
    const rename = page.getByRole('button', { name: 'Rename' });
    const external = page.getByRole('link', { name: 'Temporal Web' });

    await primary.focus();
    await page.keyboard.press('Tab');
    await expect(rename).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(external).toBeFocused();
  });
});
