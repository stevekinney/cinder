import { expect, test, type Page } from '@playwright/test';

test.describe('playground landing page', () => {
  async function readShellMarker(page: Page): Promise<string | undefined> {
    return page.evaluate(
      () => (window as typeof window & { __cinderShellMarker?: string }).__cinderShellMarker,
    );
  }

  test('renders README content at the root and returns to it with browser history', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: 'Svelte 5 components for product interfaces' }),
    ).toBeVisible();
    await expect(page.locator('.landing-page__readme')).toContainText('Install');
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#viewport-preset')).toHaveCount(0);
    await expect(page.locator('.component-name')).toHaveText('README');

    await page.evaluate(() => {
      (window as typeof window & { __cinderShellMarker?: string }).__cinderShellMarker = 'mounted';
    });

    await page.getByRole('link', { name: 'Browse components' }).click();
    await expect(page).toHaveURL(/\/c\/[^/]+$/);
    await expect.poll(() => readShellMarker(page)).toBe('mounted');
    await expect(page.locator('iframe')).toHaveAttribute('src', /\/page\/[^/]+$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => readShellMarker(page)).toBe('mounted');
    await expect(
      page.getByRole('heading', { name: 'Svelte 5 components for product interfaces' }),
    ).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#viewport-preset')).toHaveCount(0);
    await expect(page.locator('.component-name')).toHaveText('README');
  });
});
