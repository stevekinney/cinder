/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test';

const AVATAR_GROUP_ROUTE = '/page/avatar-group?snapshot=1';
const BASIC_EXAMPLE = '#example-mount-basic';

async function blurToBody(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.focus();
  });
}

async function activeElementSummary(page: Page): Promise<string> {
  return page.evaluate(() => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return '<none>';

    const className =
      typeof activeElement.className === 'string' && activeElement.className
        ? `.${activeElement.className.trim().replace(/\s+/g, '.')}`
        : '';
    const label = activeElement.getAttribute('aria-label');
    const labelSuffix = label ? `[aria-label="${label}"]` : '';

    return `${activeElement.tagName.toLowerCase()}${className}${labelSuffix}`;
  });
}

async function tabUntilFocused(
  page: Page,
  target: Locator,
  label: string,
  maxPresses = 40,
): Promise<void> {
  for (let attempt = 0; attempt < maxPresses; attempt += 1) {
    await page.keyboard.press('Tab');
    const landed = await target.evaluate((element) => element === document.activeElement);
    if (landed) return;
  }

  throw new Error(
    `Tab walk did not reach ${label}; active element is ${await activeElementSummary(page)}`,
  );
}

function boxShadowLayerCount(boxShadow: string): number {
  return boxShadow.split(/,(?![^(]*\))/).length;
}

test.describe('avatar-group focus rings', () => {
  test('avatar-group keyboard focus paints the trigger ring', async ({ page }) => {
    await page.goto(AVATAR_GROUP_ROUTE, { waitUntil: 'load' });
    await page.waitForSelector(BASIC_EXAMPLE, { state: 'visible', timeout: 20_000 });

    const trigger = page.locator(
      `${BASIC_EXAMPLE} .cinder-avatar-group__trigger[aria-label="Ada Lovelace"]`,
    );
    await expect(trigger).toBeVisible();

    await blurToBody(page);
    await tabUntilFocused(page, trigger, 'Ada Lovelace avatar trigger');
    await expect(trigger).toBeFocused();

    const paint = await trigger.evaluate((element) => {
      const styles = getComputedStyle(element as HTMLElement);
      return {
        boxShadow: styles.boxShadow,
        matchesFocusVisible: element.matches(':focus-visible'),
        ringWidth: styles.getPropertyValue('--cinder-ring-width').trim(),
      };
    });

    expect(paint.matchesFocusVisible).toBe(true);
    expect(paint.boxShadow).not.toBe('none');
    expect(boxShadowLayerCount(paint.boxShadow)).toBeGreaterThanOrEqual(2);
    expect(paint.ringWidth).not.toBe('');
  });
});
