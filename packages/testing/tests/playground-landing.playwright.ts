import { expect, test, type Page } from '@playwright/test';

test.describe('playground landing page', () => {
  async function computedMetrics(locator: ReturnType<Page['locator']>): Promise<{
    width: number;
    parentWidth: number;
    color: string;
  }> {
    return locator.evaluate((element) => {
      const htmlElement = element as HTMLElement;
      const parent = htmlElement.parentElement;
      const style = getComputedStyle(htmlElement);
      return {
        width: htmlElement.getBoundingClientRect().width,
        parentWidth: parent?.getBoundingClientRect().width ?? 0,
        color: style.color,
      };
    });
  }

  async function readShellMarker(page: Page): Promise<string | undefined> {
    return page.evaluate(
      () => (window as typeof window & { __cinderShellMarker?: string }).__cinderShellMarker,
    );
  }

  test('renders README content at the root and returns to it with browser history', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'cinder', exact: true })).toBeVisible();
    await expect(page.getByText('Svelte 5 components for product interfaces')).toHaveCount(0);
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
    await expect(page.getByRole('heading', { name: 'cinder', exact: true })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#viewport-preset')).toHaveCount(0);
    await expect(page.locator('.component-name')).toHaveText('README');
  });

  test('presents README content with usable landing-page layout styles', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const browseLink = page.getByRole('link', { name: 'Browse components' });
    const browseMetrics = await computedMetrics(browseLink);
    expect(browseMetrics.width).toBeLessThan(browseMetrics.parentWidth);

    const table = page.locator('.landing-page__readme table').first();
    const tableMetrics = await computedMetrics(table);
    expect(Math.round(tableMetrics.width)).toBe(Math.round(tableMetrics.parentWidth));

    const highlightedToken = page
      .locator('.landing-page__readme pre code span[style*="--syntax-"]')
      .first();
    await expect(highlightedToken).toBeVisible();
    const codeMetrics = await computedMetrics(highlightedToken);
    expect(codeMetrics.color).not.toBe(browseMetrics.color);
  });
});
