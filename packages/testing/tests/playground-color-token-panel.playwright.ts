import { expect, test, type Locator, type Page } from '@playwright/test';

const TOKEN_NAME = '--cinder-accent';
const SUCCESS_TOKEN_NAME = '--cinder-success';
const DANGER_TOKEN_NAME = '--cinder-danger';
const SURFACE_TOKEN_NAME = '--cinder-surface';
const EXPECTED_COLOR_TOKEN_COUNT = 56;
const LIGHT_ADVANCED_OVERRIDE = 'oklch(60% 0.2 195)';
const LIGHT_BULK_OVERRIDE = '#118833';
const DARK_BULK_OVERRIDE = '#884422';
const STALE_DARK_MESSAGE_OVERRIDE = '#123456';
const MATCHING_LIGHT_MESSAGE_OVERRIDE = '#654321';

const PICKER_SEED_TOKENS = [
  '--cinder-surface',
  '--cinder-surface-raised',
  '--cinder-accent',
  '--cinder-color-info-bg',
  '--cinder-chart-series-1',
  '--cinder-ring-color',
] as const;

type ColorTokenSwatchState = {
  token: string;
  resolved: string;
  swatch: string;
  inputValue: string;
};

type ColorTriggerFocusState = {
  token: string | null;
  triggerBoxShadow: string;
  triggerMatchesFocusVisible: boolean;
  swatchBoxShadow: string;
  swatchOutlineStyle: string;
  swatchOutlineWidth: string;
};

type ColorTokenRowLayoutState = {
  triggerTitle: string | null;
  rowInputCount: number;
  rowHorizontalOverflow: number;
  valueSummaryRightGap: number;
  valueChipText: string;
  resetCenterRatio: number | null;
};

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

async function expandedColorTriggerTokenNames(page: Page): Promise<string[]> {
  return page
    .locator('.color-token-panel .token-color-trigger[aria-expanded="true"]')
    .evaluateAll((elements) =>
      elements.map(
        (element) => element.closest('[data-color-token]')?.getAttribute('data-color-token') ?? '',
      ),
    );
}

async function swatchBoxShadowValue(page: Page, tokenName: string): Promise<string> {
  return page
    .locator(`[data-color-token="${tokenName}"] .token-color-trigger__swatch`)
    .evaluate((element) => getComputedStyle(element).boxShadow);
}

async function colorTokenSwatchStates(page: Page): Promise<ColorTokenSwatchState[]> {
  return page.locator('[data-color-token]').evaluateAll((rows) => {
    return rows.map((row) => {
      const token = row.getAttribute('data-color-token') ?? '';
      const input = row.querySelector('input');
      const swatch = row.querySelector('.token-color-trigger__swatch');
      const probe = document.createElement('span');
      probe.style.backgroundColor = `var(${token})`;
      document.body.append(probe);
      const resolved = getComputedStyle(probe).backgroundColor;
      probe.remove();

      return {
        token,
        resolved,
        swatch: swatch === null ? '' : getComputedStyle(swatch).backgroundColor,
        inputValue: input instanceof HTMLInputElement ? input.value : '',
      };
    });
  });
}

function countBoxShadowLayers(value: string): number {
  if (value === 'none') return 0;

  let depth = 0;
  let layers = 1;
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) layers += 1;
  }
  return layers;
}

function colorChannelToHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
}

function splitColorChannels(value: string): string[] {
  return value
    .replace(/\s*\/\s*/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function parseUnitIntervalChannel(channel: string): number | null {
  const parsed = Number.parseFloat(channel);
  if (!Number.isFinite(parsed)) return null;
  return channel.trim().endsWith('%') ? parsed / 100 : parsed;
}

function parseHueDegrees(channel: string): number | null {
  const trimmed = channel.trim().toLowerCase();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (trimmed.endsWith('turn')) return parsed * 360;
  if (trimmed.endsWith('rad')) return (parsed * 180) / Math.PI;
  if (trimmed.endsWith('grad')) return parsed * 0.9;
  return parsed;
}

function linearSrgbToDisplayChannel(channel: number): number {
  const clamped = Math.min(1, Math.max(0, channel));
  if (clamped <= 0.003_130_8) return clamped * 12.92;
  return 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function oklabToHex(lightness: number, greenRed: number, blueYellow: number): string {
  const long = lightness + 0.396_337_777_4 * greenRed + 0.215_803_757_3 * blueYellow;
  const medium = lightness - 0.105_561_345_8 * greenRed - 0.063_854_172_8 * blueYellow;
  const short = lightness - 0.089_484_177_5 * greenRed - 1.291_485_548 * blueYellow;

  const longCubed = long ** 3;
  const mediumCubed = medium ** 3;
  const shortCubed = short ** 3;

  const red =
    4.076_741_662_1 * longCubed - 3.307_711_591_3 * mediumCubed + 0.230_969_929_2 * shortCubed;
  const green =
    -1.268_438_004_6 * longCubed + 2.609_757_401_1 * mediumCubed - 0.341_319_396_5 * shortCubed;
  const blue =
    -0.004_196_086_3 * longCubed - 0.703_418_614_7 * mediumCubed + 1.707_614_701 * shortCubed;

  return `#${colorChannelToHex(linearSrgbToDisplayChannel(red) * 255)}${colorChannelToHex(
    linearSrgbToDisplayChannel(green) * 255,
  )}${colorChannelToHex(linearSrgbToDisplayChannel(blue) * 255)}`;
}

function oklchColorToHex(value: string): string | null {
  const match = /^oklch\((?<body>.+)\)$/i.exec(value.trim());
  const body = match?.groups?.['body'];
  if (body === undefined) return null;

  const [lightnessValue, chromaValue, hueValue] = splitColorChannels(body);
  if (lightnessValue === undefined || chromaValue === undefined || hueValue === undefined) {
    return null;
  }

  const lightness = parseUnitIntervalChannel(lightnessValue);
  const chroma = parseUnitIntervalChannel(chromaValue);
  const hue = parseHueDegrees(hueValue);
  if (lightness === null || chroma === null || hue === null) return null;

  const hueRadians = (hue * Math.PI) / 180;
  return oklabToHex(lightness, chroma * Math.cos(hueRadians), chroma * Math.sin(hueRadians));
}

function oklabColorToHex(value: string): string | null {
  const match = /^oklab\((?<body>.+)\)$/i.exec(value.trim());
  const body = match?.groups?.['body'];
  if (body === undefined) return null;

  const [lightnessValue, greenRedValue, blueYellowValue] = splitColorChannels(body);
  if (
    lightnessValue === undefined ||
    greenRedValue === undefined ||
    blueYellowValue === undefined
  ) {
    return null;
  }

  const lightness = parseUnitIntervalChannel(lightnessValue);
  const greenRed = parseUnitIntervalChannel(greenRedValue);
  const blueYellow = parseUnitIntervalChannel(blueYellowValue);
  if (lightness === null || greenRed === null || blueYellow === null) return null;

  return oklabToHex(lightness, greenRed, blueYellow);
}

function srgbColorFunctionToHex(value: string): string | null {
  const match = /^color\((?<body>.+)\)$/i.exec(value.trim());
  const body = match?.groups?.['body'];
  if (body === undefined) return null;

  const [space, redValue, greenValue, blueValue] = splitColorChannels(body);
  if (
    space?.toLowerCase() !== 'srgb' ||
    redValue === undefined ||
    greenValue === undefined ||
    blueValue === undefined
  ) {
    return null;
  }

  const red = parseUnitIntervalChannel(redValue);
  const green = parseUnitIntervalChannel(greenValue);
  const blue = parseUnitIntervalChannel(blueValue);
  if (red === null || green === null || blue === null) return null;

  return `#${colorChannelToHex(red * 255)}${colorChannelToHex(green * 255)}${colorChannelToHex(
    blue * 255,
  )}`;
}

function modernColorFunctionToHex(value: string): string | null {
  return oklchColorToHex(value) ?? oklabColorToHex(value) ?? srgbColorFunctionToHex(value);
}

function resolvedRgbColorToHex(value: string): string | null {
  const match = /^rgba?\((?<channels>.+)\)$/i.exec(value.trim());
  const channels = match?.groups?.['channels'];
  if (channels === undefined) return null;

  const [red, green, blue] = channels
    .replaceAll(',', ' ')
    .replace(/\s*\/\s*/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(Number.parseFloat);

  if (red === undefined || green === undefined || blue === undefined) return null;
  if (![red, green, blue].every((channel) => Number.isFinite(channel))) return null;

  return `#${colorChannelToHex(red)}${colorChannelToHex(green)}${colorChannelToHex(blue)}`;
}

async function resolvedCssColorToHex(page: Page, value: string): Promise<string | null> {
  const directHex = resolvedRgbColorToHex(value) ?? modernColorFunctionToHex(value);
  if (directHex !== null) return directHex;

  return page.evaluate((cssColor) => {
    function channelToHex(channel: number): string {
      return Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, '0');
    }

    function rgbToHex(color: string): string | null {
      const match = /^rgba?\((?<channels>.+)\)$/i.exec(color.trim());
      const channels = match?.groups?.['channels'];
      if (channels === undefined) return null;

      const [red, green, blue] = channels
        .replaceAll(',', ' ')
        .replace(/\s*\/\s*/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map(Number.parseFloat);

      if (red === undefined || green === undefined || blue === undefined) return null;
      if (![red, green, blue].every((channel) => Number.isFinite(channel))) return null;

      return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context !== null) {
      context.fillStyle = '#000000';
      context.fillStyle = cssColor;
      const normalized = context.fillStyle;
      if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized.toLowerCase();
      const canvasHex = rgbToHex(normalized);
      if (canvasHex !== null) return canvasHex;
    }

    const probe = document.createElement('span');
    probe.style.backgroundColor = cssColor;
    document.body.append(probe);
    const computed = getComputedStyle(probe).backgroundColor;
    probe.remove();

    return rgbToHex(computed);
  }, value);
}

async function clickRelative(
  page: Page,
  locator: Locator,
  xRatio: number,
  yRatio: number,
): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
}

async function openColorTokenPanel(page: Page): Promise<Locator> {
  await page.getByTestId('color-token-panel-toggle').click();
  const panel = page.getByTestId('color-token-panel');
  await expect(panel).toBeVisible();
  return panel;
}

async function openTokenPicker(page: Page, tokenName: string): Promise<Locator> {
  const row = page.locator(`[data-color-token="${tokenName}"]`);
  await row.getByRole('button', { name: `Pick ${tokenName} color` }).click();
  const dialog = page.getByRole('dialog', { name: `Pick ${tokenName} color` });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillTokenCssValue(page: Page, tokenName: string, value: string): Promise<void> {
  const dialog = await openTokenPicker(page, tokenName);
  const cssButton = dialog.getByRole('button', { name: 'CSS' });
  await cssButton.click();
  await expect(cssButton).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByLabel(`${tokenName} CSS value`).fill(value);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

async function focusNextColorTrigger(page: Page): Promise<string> {
  for (let index = 0; index < 25; index += 1) {
    const tokenName = await page.evaluate(() => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement)) return null;
      if (!activeElement.classList.contains('token-color-trigger')) return null;
      return activeElement.closest('[data-color-token]')?.getAttribute('data-color-token') ?? null;
    });
    if (tokenName !== null) return tokenName;
    await page.keyboard.press('Tab');
  }

  throw new Error('Expected keyboard focus to reach a color token trigger.');
}

async function colorTriggerFocusState(page: Page): Promise<ColorTriggerFocusState> {
  return page.evaluate(() => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
      return {
        token: null,
        triggerBoxShadow: '',
        triggerMatchesFocusVisible: false,
        swatchBoxShadow: '',
        swatchOutlineStyle: '',
        swatchOutlineWidth: '',
      };
    }

    const row = activeElement.closest('[data-color-token]');
    const swatch = activeElement.querySelector('.token-color-trigger__swatch');
    const swatchStyle = swatch === null ? null : getComputedStyle(swatch);
    return {
      token: row?.getAttribute('data-color-token') ?? null,
      triggerBoxShadow: getComputedStyle(activeElement).boxShadow,
      triggerMatchesFocusVisible: activeElement.matches(':focus-visible'),
      swatchBoxShadow: swatchStyle?.boxShadow ?? '',
      swatchOutlineStyle: swatchStyle?.outlineStyle ?? '',
      swatchOutlineWidth: swatchStyle?.outlineWidth ?? '',
    };
  });
}

async function colorTokenRowLayoutState(
  page: Page,
  tokenName: string,
): Promise<ColorTokenRowLayoutState> {
  return page.locator(`[data-color-token="${tokenName}"]`).evaluate((row) => {
    const trigger = row.querySelector<HTMLElement>('.token-color-trigger');
    const heading = row.querySelector<HTMLElement>('.token-row__heading');
    const valueSummary = row.querySelector<HTMLElement>('.token-value-summary');
    const valueChip = row.querySelector<HTMLElement>('.token-value-chip');
    if (trigger === null || heading === null || valueSummary === null || valueChip === null) {
      throw new Error('Color token row is missing expected editor structure.');
    }

    const rowBox = row.getBoundingClientRect();
    const valueSummaryBox = valueSummary.getBoundingClientRect();
    const resetButton = row.querySelector<HTMLElement>('.token-reset-button');
    const resetBox = resetButton?.getBoundingClientRect();

    return {
      triggerTitle: trigger.getAttribute('title'),
      rowInputCount: row.querySelectorAll('input.cinder-input').length,
      rowHorizontalOverflow: row.scrollWidth - row.clientWidth,
      valueSummaryRightGap: rowBox.right - valueSummaryBox.right,
      valueChipText: valueChip.textContent?.trim() ?? '',
      resetCenterRatio:
        resetBox === undefined
          ? null
          : (resetBox.left + resetBox.width / 2 - rowBox.left) / rowBox.width,
    };
  });
}

async function postIframeColorOverrideMessage(
  page: Page,
  theme: 'light' | 'dark',
  overrides: Record<string, string>,
): Promise<void> {
  await page.evaluate(
    ({ theme: messageTheme, overrides: messageOverrides }) => {
      const iframe = document.querySelector<HTMLIFrameElement>('iframe[data-cinder-preview]');
      iframe?.contentWindow?.postMessage(
        {
          type: 'cinder:set-color-token-overrides',
          theme: messageTheme,
          overrides: messageOverrides,
        },
        window.location.origin,
      );
    },
    { theme, overrides },
  );
}

test.describe('playground color token panel', () => {
  test('supports visual color editing with correct swatches, focus, theme isolation, and reset UX', async ({
    page,
  }) => {
    await page.goto('/c/button', { waitUntil: 'load' });
    await waitForPlayground(page);

    await page.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-cinder-theme', 'light');

    const panel = await openColorTokenPanel(page);
    await expect(page.locator('#color-token-filter')).toBeFocused();
    await expect
      .poll(() =>
        panel
          .locator('.token-group > h3')
          .evaluateAll((headings) => headings.map((heading) => heading.textContent?.trim() ?? '')),
      )
      .toEqual([
        'Accent',
        'Status Solids',
        'Chart Series',
        'Status Surfaces',
        'Surfaces',
        'Text and Disabled Fill',
        'Borders',
        'Focus Ring',
        'Overlay',
        'Scrollbars',
      ]);

    const swatchStates = await colorTokenSwatchStates(page);
    expect(swatchStates).toHaveLength(EXPECTED_COLOR_TOKEN_COUNT);
    expect(
      swatchStates.filter((state) => state.swatch !== state.resolved),
      'each swatch should render the same browser-resolved color as its token',
    ).toEqual([]);
    expect(
      swatchStates.filter(
        (state) => state.swatch === 'rgb(0, 0, 0)' && state.resolved !== 'rgb(0, 0, 0)',
      ),
      'a swatch must not fall back to black when the token resolves to another color',
    ).toEqual([]);

    const surfaceResolvedColor = await renderedTokenBackgroundValue(page, SURFACE_TOKEN_NAME);
    expect(surfaceResolvedColor).not.toBe('rgb(0, 0, 0)');
    await expect
      .poll(() => swatchBackgroundValue(page, SURFACE_TOKEN_NAME))
      .toBe(surfaceResolvedColor);

    for (const tokenName of PICKER_SEED_TOKENS) {
      const resolvedColor = await renderedTokenBackgroundValue(page, tokenName);
      const resolvedHex = await resolvedCssColorToHex(page, resolvedColor);
      const pickerDialog = await openTokenPicker(page, tokenName);
      const hexValue = pickerDialog.locator('.cinder-color-picker__hex-value');
      expect(resolvedHex, `${tokenName} resolved to ${resolvedColor}`).not.toBeNull();
      await expect(hexValue).toHaveText(resolvedHex ?? '');
      await expect.poll(() => colorTriggerBoxShadowValue(page, tokenName)).toBe('none');
      await expect
        .poll(async () => {
          const boxShadowValues = await colorTriggerBoxShadowValues(page);
          return boxShadowValues.filter((value) => value !== 'none');
        })
        .toEqual([]);
      await page.keyboard.press('Escape');
      await expect(pickerDialog).toBeHidden();
      await expect.poll(() => expandedColorTriggerTokenNames(page)).toEqual([]);
      await expect(panel).toBeVisible();
    }

    const normalSurfaceSwatchShadow = await swatchBoxShadowValue(page, SURFACE_TOKEN_NAME);
    await panel.getByRole('button', { name: 'Close color token panel' }).focus();
    const focusedTokenName = await focusNextColorTrigger(page);
    expect(focusedTokenName).toBe(TOKEN_NAME);
    const focusState = await colorTriggerFocusState(page);
    expect(focusState).toEqual(
      expect.objectContaining({
        token: TOKEN_NAME,
        triggerBoxShadow: 'none',
        triggerMatchesFocusVisible: true,
      }),
    );
    expect(countBoxShadowLayers(focusState.swatchBoxShadow)).toBeGreaterThan(
      countBoxShadowLayers(normalSurfaceSwatchShadow),
    );

    const accentRow = page.locator(`[data-color-token="${TOKEN_NAME}"]`);
    const accentColorPickerButton = accentRow.getByRole('button', {
      name: `Pick ${TOKEN_NAME} color`,
    });
    await expect(accentRow.getByRole('button', { name: `Reset ${TOKEN_NAME}` })).toHaveCount(0);
    expect(await accentColorPickerButton.getAttribute('title')).toBeNull();
    await expect(panel.locator('.token-row input.cinder-input')).toHaveCount(0);
    const visibleTokenRowText = await panel
      .locator('.token-row')
      .evaluateAll((rows) => rows.map((row) => row.textContent ?? '').join('\n'));
    expect(visibleTokenRowText).not.toContain('light-dark(');
    expect(visibleTokenRowText).not.toContain('oklch(');
    const initialAccentRowLayout = await colorTokenRowLayoutState(page, TOKEN_NAME);
    expect(initialAccentRowLayout).toEqual(
      expect.objectContaining({
        triggerTitle: null,
        rowInputCount: 0,
      }),
    );
    expect(initialAccentRowLayout.rowHorizontalOverflow).toBeLessThanOrEqual(1);
    expect(initialAccentRowLayout.valueSummaryRightGap).toBeGreaterThanOrEqual(0);
    expect(initialAccentRowLayout.valueChipText).toMatch(/^#[0-9a-f]{6}$/i);
    await accentColorPickerButton.click();
    const pickerDialog = page.getByRole('dialog', { name: `Pick ${TOKEN_NAME} color` });
    await expect(pickerDialog).toBeVisible();
    const priorAccentValue = await shellTokenValue(page, TOKEN_NAME);
    await clickRelative(page, pickerDialog.locator('.cinder-color-picker__hue'), 0.55, 0.5);
    await clickRelative(page, pickerDialog.locator('.cinder-color-picker__gradient'), 0.72, 0.35);
    const visualPickerText = await pickerDialog
      .locator('.cinder-color-picker__hex-value')
      .textContent();
    const visualPickerValue = visualPickerText?.trim() ?? '';
    expect(visualPickerValue).toMatch(/^#[0-9a-f]{6}$/i);
    expect(visualPickerValue).not.toBe(priorAccentValue);

    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).toBe(visualPickerValue);
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).toBe(visualPickerValue);
    await expect(accentRow.getByRole('button', { name: `Reset ${TOKEN_NAME}` })).toBeVisible();
    const overriddenAccentRowLayout = await colorTokenRowLayoutState(page, TOKEN_NAME);
    expect(overriddenAccentRowLayout.resetCenterRatio).toBeGreaterThan(0.9);
    expect(overriddenAccentRowLayout.rowInputCount).toBe(0);
    expect(overriddenAccentRowLayout.rowHorizontalOverflow).toBeLessThanOrEqual(1);
    expect(overriddenAccentRowLayout.valueSummaryRightGap).toBeGreaterThanOrEqual(0);
    expect(overriddenAccentRowLayout.valueChipText).toBe(visualPickerValue.toLowerCase());
    await page.keyboard.press('Escape');
    await expect(pickerDialog).toBeHidden();
    await expect.poll(() => expandedColorTriggerTokenNames(page)).toEqual([]);
    await expect(panel).toBeVisible();

    await fillTokenCssValue(page, SUCCESS_TOKEN_NAME, LIGHT_BULK_OVERRIDE);
    await expect.poll(() => shellTokenValue(page, SUCCESS_TOKEN_NAME)).toBe(LIGHT_BULK_OVERRIDE);
    await expect.poll(() => iframeTokenValue(page, SUCCESS_TOKEN_NAME)).toBe(LIGHT_BULK_OVERRIDE);

    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-cinder-theme', 'dark');
    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).not.toBe(visualPickerValue);
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).not.toBe(visualPickerValue);
    await fillTokenCssValue(page, DANGER_TOKEN_NAME, DARK_BULK_OVERRIDE);
    await expect.poll(() => shellTokenValue(page, DANGER_TOKEN_NAME)).toBe(DARK_BULK_OVERRIDE);

    await page.getByRole('radio', { name: 'Light' }).click();
    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).toBe(visualPickerValue);
    await expect.poll(() => shellTokenValue(page, SUCCESS_TOKEN_NAME)).toBe(LIGHT_BULK_OVERRIDE);
    await expect(page.getByRole('button', { name: 'Reset light' })).toBeEnabled();
    await page.getByRole('button', { name: 'Reset light' }).click();
    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).not.toBe(visualPickerValue);
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).not.toBe(visualPickerValue);
    await expect
      .poll(() => shellTokenValue(page, SUCCESS_TOKEN_NAME))
      .not.toBe(LIGHT_BULK_OVERRIDE);
    await expect
      .poll(() => iframeTokenValue(page, SUCCESS_TOKEN_NAME))
      .not.toBe(LIGHT_BULK_OVERRIDE);
    await expect(page.getByRole('button', { name: 'Reset light' })).toBeDisabled();

    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect.poll(() => shellTokenValue(page, DANGER_TOKEN_NAME)).toBe(DARK_BULK_OVERRIDE);
    await expect.poll(() => iframeTokenValue(page, DANGER_TOKEN_NAME)).toBe(DARK_BULK_OVERRIDE);

    await page.getByRole('radio', { name: 'Light' }).click();
    await fillTokenCssValue(page, TOKEN_NAME, LIGHT_ADVANCED_OVERRIDE);
    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).toBe(LIGHT_ADVANCED_OVERRIDE);
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).toBe(LIGHT_ADVANCED_OVERRIDE);

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.getByTestId('color-token-panel-toggle')).toBeFocused();
    await expect(page.getByTestId('color-token-panel-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await page.reload({ waitUntil: 'load' });
    await waitForPlayground(page);
    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).not.toBe(LIGHT_ADVANCED_OVERRIDE);
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).not.toBe(LIGHT_ADVANCED_OVERRIDE);
  });

  test('keeps token row actions and value input usable at narrow widths', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/c/button', { waitUntil: 'load' });
    await waitForPlayground(page);

    await page.getByRole('radio', { name: 'Light' }).click();
    const panel = await openColorTokenPanel(page);
    const accentRow = page.locator(`[data-color-token="${TOKEN_NAME}"]`);
    const accentColorPickerButton = accentRow.getByRole('button', {
      name: `Pick ${TOKEN_NAME} color`,
    });

    expect(await accentColorPickerButton.getAttribute('title')).toBeNull();
    await expect(panel.locator('.token-row input.cinder-input')).toHaveCount(0);
    await expect(accentRow.getByRole('button', { name: `Reset ${TOKEN_NAME}` })).toHaveCount(0);
    const initialLayout = await colorTokenRowLayoutState(page, TOKEN_NAME);
    expect(initialLayout.rowInputCount).toBe(0);
    expect(initialLayout.rowHorizontalOverflow).toBeLessThanOrEqual(1);
    expect(initialLayout.valueSummaryRightGap).toBeGreaterThanOrEqual(0);
    expect(initialLayout.valueChipText).toMatch(/^#[0-9a-f]{6}$/i);

    await fillTokenCssValue(page, TOKEN_NAME, '#00c4c7');
    await expect.poll(() => shellTokenValue(page, TOKEN_NAME)).toBe('#00c4c7');
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).toBe('#00c4c7');
    await expect(accentRow.getByRole('button', { name: `Reset ${TOKEN_NAME}` })).toBeVisible();
    const overriddenLayout = await colorTokenRowLayoutState(page, TOKEN_NAME);
    expect(overriddenLayout.resetCenterRatio).toBeGreaterThan(0.85);
    expect(overriddenLayout.rowInputCount).toBe(0);
    expect(overriddenLayout.rowHorizontalOverflow).toBeLessThanOrEqual(1);
    expect(overriddenLayout.valueSummaryRightGap).toBeGreaterThanOrEqual(0);
    expect(overriddenLayout.valueChipText).toBe('#00c4c7');
    await expect(panel).toBeVisible();
  });

  test('preview frame ignores stale wrong-theme color override messages', async ({ page }) => {
    await page.goto('/c/button', { waitUntil: 'load' });
    await waitForPlayground(page);

    await page.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-cinder-theme', 'light');
    await expect.poll(() => iframeTokenValue(page, TOKEN_NAME)).not.toBe('');

    await postIframeColorOverrideMessage(page, 'dark', {
      [TOKEN_NAME]: STALE_DARK_MESSAGE_OVERRIDE,
    });
    await postIframeColorOverrideMessage(page, 'light', {
      [SUCCESS_TOKEN_NAME]: LIGHT_BULK_OVERRIDE,
    });
    await expect.poll(() => iframeTokenValue(page, SUCCESS_TOKEN_NAME)).toBe(LIGHT_BULK_OVERRIDE);
    expect(await iframeTokenValue(page, TOKEN_NAME)).not.toBe(STALE_DARK_MESSAGE_OVERRIDE);

    await postIframeColorOverrideMessage(page, 'light', {
      [TOKEN_NAME]: MATCHING_LIGHT_MESSAGE_OVERRIDE,
    });
    await expect
      .poll(() => iframeTokenValue(page, TOKEN_NAME))
      .toBe(MATCHING_LIGHT_MESSAGE_OVERRIDE);
  });

  test('token trigger focus remains visible when forced-colors mode disables shadows', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/c/button', { waitUntil: 'load' });
    await waitForPlayground(page);

    await page.getByRole('radio', { name: 'Light' }).click();
    const panel = await openColorTokenPanel(page);
    await expect(page.locator('#color-token-filter')).toBeFocused();

    const focusedTokenName = await focusNextColorTrigger(page);
    expect(focusedTokenName).toBe(TOKEN_NAME);
    const focusState = await colorTriggerFocusState(page);
    expect(focusState).toEqual(
      expect.objectContaining({
        token: TOKEN_NAME,
        triggerBoxShadow: 'none',
        triggerMatchesFocusVisible: true,
        swatchBoxShadow: 'none',
        swatchOutlineStyle: 'solid',
      }),
    );
    expect(focusState.swatchOutlineWidth).not.toBe('0px');
    await expect(panel).toBeVisible();
  });
});
