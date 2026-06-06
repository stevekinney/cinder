import { expect, test } from '@playwright/test';

test.describe('playground component documentation', () => {
  test('button exposes documentation tabs and generated artifacts', async ({ page }) => {
    await page.goto('/c/button', { waitUntil: 'load' });
    const preview = page.frameLocator('iframe[data-cinder-preview]');

    for (const tabName of ['Overview', 'Examples', 'API', 'Constraints', 'Raw Artifacts']) {
      await expect(preview.getByRole('tab', { name: tabName })).toBeVisible();
    }

    await expect(preview.getByRole('heading', { name: 'Button' })).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'Overview' })).toHaveCount(0);
    await preview.getByRole('tab', { name: 'API' }).click();
    await expect(preview.getByRole('heading', { name: 'API' })).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'JSON Schema' })).toBeVisible();

    await preview.getByRole('tab', { name: 'Constraints' }).click();
    await expect(preview.getByRole('heading', { name: 'Constraints' })).toBeVisible();
    await expect(
      preview.locator('.constraint-rules code', { hasText: 'accessible-name' }),
    ).toBeVisible();

    await preview.getByRole('tab', { name: 'Raw Artifacts' }).click();
    await expect(preview.getByRole('heading', { name: 'Raw Artifacts' })).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'Manifest Entry' })).toBeVisible();
    await expect(preview.getByText('"id": "button"')).toBeVisible();
  });

  test('avatar-group exposes styling variables', async ({ page }) => {
    await page.goto('/c/avatar-group', { waitUntil: 'load' });
    const preview = page.frameLocator('iframe[data-cinder-preview]');

    await preview.getByRole('tab', { name: 'Styling' }).click();
    await expect(preview.getByRole('heading', { name: 'Styling' })).toBeVisible();
    await expect(
      preview.locator('.variable-list code', { hasText: '--cinder-avatar-group-overlap' }),
    ).toBeVisible();
  });
});
