import { expect, test, type Page } from '@playwright/test';

const TOKEN_NAME = '--cinder-accent';
const SURFACE_TOKEN_NAME = '--cinder-surface';
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

async function renderedTokenBackgroundValue(page: Page, tokenName: string): Promise<string> {
  return page.evaluate((token) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = `var(${token})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }, tokenName);
}

async function swatchBackgroundValue(page: Page, tokenName: string): Promise<string> {
  return page
    .locator(`[data-color-token="${tokenName}"] .token-color-trigger__swatch`)
    .evaluate((element) => getComputedStyle(element).backgroundColor);
}

async function colorTriggerBoxShadowValue(page: Page, tokenName: string): Promise<string> {
  return page
    .locator(`[data-color-token="${tokenName}"] .token-color-trigger`)
    .evaluate((element) => getComputedStyle(element).boxShadow);
}

async function colorTriggerBoxShadowValues(page: Page): Promise<string[]> {
  return page.locator('.color-token-panel .token-color-trigger').evaluateAll((elements) => {
    return elements.map((element) => getComputedStyle(element).boxShadow);
  });
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

    const surfaceResolvedColor = await renderedTokenBackgroundValue(page, SURFACE_TOKEN_NAME);
    expect(surfaceResolvedColor).not.toBe('rgb(0, 0, 0)');
    await expect
      .poll(() => swatchBackgroundValue(page, SURFACE_TOKEN_NAME))
      .toBe(surfaceResolvedColor);

    const surfaceRow = page.locator(`[data-color-token="${SURFACE_TOKEN_NAME}"]`);
    await surfaceRow.getByRole('button', { name: `Pick ${SURFACE_TOKEN_NAME} color` }).click();
    const surfacePickerDialog = page.getByRole('dialog', {
      name: `Pick ${SURFACE_TOKEN_NAME} color`,
    });
    await expect(surfacePickerDialog).toBeVisible();
    await expect.poll(() => colorTriggerBoxShadowValue(page, SURFACE_TOKEN_NAME)).toBe('none');
    await expect
      .poll(async () => {
        const boxShadowValues = await colorTriggerBoxShadowValues(page);
        return boxShadowValues.filter((value) => value !== 'none');
      })
      .toEqual([]);
    await expect(surfacePickerDialog.locator('.cinder-color-picker__hex-value')).toHaveText(
      /^#[0-9a-f]{6}$/i,
    );
    await expect(surfacePickerDialog.locator('.cinder-color-picker__hex-value')).not.toHaveText(
      '#000000',
    );
    await page.keyboard.press('Escape');
    await expect(surfacePickerDialog).toBeHidden();

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
