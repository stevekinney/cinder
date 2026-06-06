/// <reference lib="dom" />
/**
 * Regression coverage for playground-owned page chrome on `/page/:name`.
 *
 * The broad focus sweep should be able to separate component-under-test focus
 * rings from reusable playground chrome. These assertions therefore target the
 * component page's own `View source` accordion trigger and props-table scroll
 * region on a stable non-Accordion page.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

const PIXEL_TOLERANCE = 0.5;

type ActiveElementSummary = {
  ariaLabel: string | null;
  className: string;
  id: string;
  role: string | null;
  tagName: string;
  text: string;
};

type FocusPaint = {
  boxShadow: string;
  matchesFocusVisible: boolean;
  outlineColor: string;
  outlineOffset: number;
  outlineStyle: string;
  outlineWidth: number;
  ringColor: string;
  ringWidth: number;
};

async function activeElementSummary(page: Page): Promise<ActiveElementSummary | null> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    return {
      ariaLabel: active.getAttribute('aria-label'),
      className: active.className,
      id: active.id,
      role: active.getAttribute('role'),
      tagName: active.tagName.toLowerCase(),
      text: (active.textContent ?? '').trim().replaceAll(/\s+/g, ' ').slice(0, 120),
    };
  });
}

async function tabUntilFocused(page: Page, target: Locator, label: string): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.focus();
  });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    await page.keyboard.press('Tab');
    const landed = await target.evaluate((element) => element === document.activeElement);
    if (landed) return;
  }

  throw new Error(
    `Tab walk did not reach ${label}. Active element: ${JSON.stringify(
      await activeElementSummary(page),
    )}`,
  );
}

async function focusPaint(locator: Locator): Promise<FocusPaint> {
  return locator.evaluate((element) => {
    const styles = getComputedStyle(element as HTMLElement);
    const ringColorToken = styles.getPropertyValue('--cinder-ring-color').trim();
    const probe = document.createElement('span');
    probe.style.color = ringColorToken;
    document.body.append(probe);
    const ringColor = getComputedStyle(probe).color;
    probe.remove();

    return {
      boxShadow: styles.boxShadow,
      matchesFocusVisible: element.matches(':focus-visible'),
      outlineColor: styles.outlineColor,
      outlineOffset: Number.parseFloat(styles.outlineOffset),
      outlineStyle: styles.outlineStyle,
      outlineWidth: Number.parseFloat(styles.outlineWidth),
      ringColor,
      ringWidth: Number.parseFloat(styles.getPropertyValue('--cinder-ring-width')),
    };
  });
}

function isTransparentColor(color: string): boolean {
  const normalizedColor = color.toLowerCase().replaceAll(/\s+/g, '');
  return (
    normalizedColor === 'transparent' ||
    normalizedColor === 'rgba(0,0,0,0)' ||
    /\/\s*0(?:[)\s]|$)/.test(color)
  );
}

function splitBoxShadowLayers(boxShadow: string): string[] {
  return boxShadow.split(/,(?![^(]*\))/).map((layer) => layer.trim());
}

function insetSpreadForRing(boxShadow: string, ringColor: string): number | null {
  const layer = splitBoxShadowLayers(boxShadow).find(
    (candidate) => candidate.includes('inset') && candidate.includes(ringColor),
  );
  if (layer === undefined) return null;
  const lengths = [...layer.matchAll(/-?\d*\.?\d+px/g)].map(([value]) => Number.parseFloat(value));
  return lengths[3] ?? null;
}

function expectInsetFocusPaint(paint: FocusPaint, label: string): void {
  expect(paint.matchesFocusVisible, `${label} should match :focus-visible`).toBe(true);
  expect(paint.outlineStyle, `${label} should keep the outline channel`).toBe('solid');
  expect(isTransparentColor(paint.outlineColor), `${label} outline should be transparent`).toBe(
    true,
  );
  expect(paint.boxShadow, `${label} should paint a focus shadow`).not.toBe('none');
  expect(paint.boxShadow, `${label} should use an inset focus shadow`).toContain('inset');
  expect(paint.boxShadow, `${label} should include the resolved ring color`).toContain(
    paint.ringColor,
  );

  const spread = insetSpreadForRing(paint.boxShadow, paint.ringColor);
  expect(spread, `${label} should expose an inset spread for the ring layer`).not.toBeNull();
  expect(
    Math.abs(spread! - paint.ringWidth),
    `${label} spread should match ring width`,
  ).toBeLessThanOrEqual(PIXEL_TOLERANCE);
}

async function openButtonPage(page: Page): Promise<{
  propsTableScroll: Locator;
  viewSourceTrigger: Locator;
}> {
  await page.goto('/page/button?snapshot=1', { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');

  const propsTableScroll = page.locator('.props-table-scroll').first();
  const propsTableCount = await page.locator('.props-table-scroll').count();
  expect(
    propsTableCount,
    '/page/button no longer exposes `.props-table-scroll`; update the stable page-chrome fixture.',
  ).toBeGreaterThan(0);

  const firstCard = page.locator('.example-list .cinder-card').first();
  await expect(firstCard).toBeVisible();
  const viewSourceTrigger = firstCard.getByRole('button', {
    exact: true,
    name: 'View source',
  });
  await expect(viewSourceTrigger).toHaveCount(1);

  return { propsTableScroll, viewSourceTrigger };
}

test.describe('playground page chrome focus rings', () => {
  test('source accordion and props-table chrome use intentional inset keyboard rings', async ({
    page,
  }) => {
    const { propsTableScroll, viewSourceTrigger } = await openButtonPage(page);

    await tabUntilFocused(page, viewSourceTrigger, 'first View source trigger');
    await expect(viewSourceTrigger).toBeFocused();
    expectInsetFocusPaint(await focusPaint(viewSourceTrigger), 'View source trigger');

    await tabUntilFocused(page, propsTableScroll, 'props table scroll region');
    await expect(propsTableScroll).toBeFocused();
    expectInsetFocusPaint(await focusPaint(propsTableScroll), 'props table scroll region');
  });

  test('forced-colors mode repaints the props-table focus outline inside the scroll container', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const { propsTableScroll } = await openButtonPage(page);

    await tabUntilFocused(page, propsTableScroll, 'props table scroll region');
    await expect(propsTableScroll).toBeFocused();

    const paint = await focusPaint(propsTableScroll);
    expect(paint.matchesFocusVisible, 'props table should match :focus-visible').toBe(true);
    expect(paint.outlineStyle, 'forced-colors outline should be solid').toBe('solid');
    expect(
      isTransparentColor(paint.outlineColor),
      'forced-colors outline should repaint with a system color',
    ).toBe(false);
    expect(
      Math.abs(paint.outlineWidth - paint.ringWidth),
      'forced-colors outline width should match ring width',
    ).toBeLessThanOrEqual(PIXEL_TOLERANCE);
    expect(paint.outlineOffset, 'forced-colors outline should be drawn inside').toBeLessThan(0);
  });
});
