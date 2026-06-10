import { expect, test } from '@playwright/test';

test.describe('playground component documentation', () => {
  test('button exposes documentation tabs and generated artifacts', async ({ page }) => {
    await page.goto('/c/button', { waitUntil: 'load' });
    const preview = page.frameLocator('iframe[data-cinder-preview]');

    for (const tabName of ['Documentation', 'Examples', 'Raw Artifacts']) {
      await expect(preview.getByRole('tab', { name: tabName })).toBeVisible();
    }
    for (const removedTab of ['API', 'Styling', 'Constraints']) {
      await expect(preview.getByRole('tab', { name: removedTab })).toHaveCount(0);
    }

    // Switch to Documentation tab to verify its content (Examples is the default tab).
    await preview.getByRole('tab', { name: 'Documentation' }).click();
    await expect(preview.getByRole('heading', { name: 'Button' })).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'API' })).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'JSON Schema' })).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'Constraints' })).toBeVisible();
    await expect(
      preview.locator('.constraint-rules code', { hasText: 'accessible-name' }),
    ).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'Featured Examples' })).toBeVisible();

    await preview.getByRole('tab', { name: 'Raw Artifacts' }).click();
    await expect(page).toHaveURL(/tab=raw-artifacts/);
    await expect(preview.getByRole('heading', { name: 'Raw Artifacts' })).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'Manifest Entry' })).toBeVisible();
    await expect(preview.getByText('"id": "button"')).toBeVisible();
    await expect(
      preview.locator('.raw-artifact-panel .cinder-code-block__highlighted .shiki').first(),
    ).toBeVisible();
  });

  test('avatar-group exposes styling variables', async ({ page }) => {
    await page.goto('/c/avatar-group', { waitUntil: 'load' });
    const preview = page.frameLocator('iframe[data-cinder-preview]');

    // Switch to Documentation tab (Examples is the default tab).
    await preview.getByRole('tab', { name: 'Documentation' }).click();
    await expect(preview.getByRole('heading', { name: 'Styling' })).toBeVisible();
    await expect(
      preview.locator('.variable-list code', { hasText: '--cinder-avatar-group-overlap' }),
    ).toBeVisible();
  });
});
