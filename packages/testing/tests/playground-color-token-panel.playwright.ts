import { expect, test, type Page } from '@playwright/test';

const TOKEN_NAME = '--cinder-accent';
const LIGHT_PICKER_OVERRIDE = '#336699';
const LIGHT_ADVANCED_OVERRIDE = 'oklch(60% 0.2 195)';

async function waitForPlayground(page: Page): Promise<void> {
  await page.waitForSelector('iframe[data-cinder-preview]', { state: 'attached' });
  await page.waitForSelector('[data-testid="color-token-panel-toggle"]', { state: 'visible' });
  await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).not.toBe('');
}

async function shellTokenValue(page: Page, tokenName: string): Promise<string> {
  return page.evaluate((token) => {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  }, tokenName);
}

async function iframeTokenValue(page: Page, tokenName: string): Promise<string> {
  const frame = page.frames().find((candidate) => candidate.url().includes('/page/button'));
  if (frame === undefined) return '';
  return frame.evaluate((token) => {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  }, tokenName);
}

test.describe('playground color token panel', () => {
  test('edits active-theme color tokens in the shell and iframe without persistence', async ({
    page,
  }) => {
    await page.goto('/c/button', { waitUntil: 'load' });
    await waitForPlayground(page);

    await page.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-cinder-theme', 'light');

    await page.getByRole('button', { name: 'Color token panel' }).click();
    const panel = page.getByTestId('color-token-panel');
    await expect(panel).toBeVisible();

    const accentRow = page.locator(`[data-color-token="${TOKEN_NAME}"]`);
    const accentColorPickerButton = accentRow.getByRole('button', {
      name: `Pick ${TOKEN_NAME} color`,
    });
    const accentInput = accentRow.getByLabel(`${TOKEN_NAME} CSS value`);
    await accentColorPickerButton.click();
    const pickerDialog = page.getByRole('dialog', { name: `Pick ${TOKEN_NAME} color` });
    await expect(pickerDialog).toBeVisible();
    await pickerDialog.getByRole('option', { name: LIGHT_PICKER_OVERRIDE }).click();

    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).toBe(LIGHT_PICKER_OVERRIDE);
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).toBe(LIGHT_PICKER_OVERRIDE);
    await expect(accentInput).toHaveValue(LIGHT_PICKER_OVERRIDE);

    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-cinder-theme', 'dark');
    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).not.toBe(LIGHT_PICKER_OVERRIDE);
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).not.toBe(LIGHT_PICKER_OVERRIDE);

    await page.getByRole('radio', { name: 'Light' }).click();
    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).toBe(LIGHT_PICKER_OVERRIDE);
    await accentRow.getByRole('button', { name: `Reset ${TOKEN_NAME}` }).click();
    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).not.toBe(LIGHT_PICKER_OVERRIDE);
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).not.toBe(LIGHT_PICKER_OVERRIDE);

    await accentInput.fill(LIGHT_ADVANCED_OVERRIDE);
    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).toBe(LIGHT_ADVANCED_OVERRIDE);
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).toBe(LIGHT_ADVANCED_OVERRIDE);

    await page.reload({ waitUntil: 'load' });
    await waitForPlayground(page);
    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).not.toBe(LIGHT_ADVANCED_OVERRIDE);
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).not.toBe(LIGHT_ADVANCED_OVERRIDE);
  });
});
