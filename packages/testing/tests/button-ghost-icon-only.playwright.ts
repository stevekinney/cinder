import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';

import { expect, test } from '../src/fixtures/component-page.ts';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';
import { THEME_STORAGE_KEY, themeContextOptions } from '../src/helpers/theme.ts';

type Theme = 'light' | 'dark';

type ButtonStyles = {
  backgroundColor: string;
  borderTopColor: string;
  borderTopStyle: string;
  borderTopWidth: string;
  boxShadow: string;
  color: string;
  cursor: string;
  outlineStyle: string;
};

async function openButtonPage(
  browser: Browser,
  theme: Theme,
  options: { forcedColors?: 'active' } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    ...themeContextOptions(theme),
    ...(options.forcedColors !== undefined ? { forcedColors: options.forcedColors } : {}),
    viewport: { width: 1280, height: 900 },
    baseURL: PLAYGROUND_URL,
  });
  await context.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    [THEME_STORAGE_KEY, theme] as const,
  );
  const page = await context.newPage();
  await page.goto('/page/button?snapshot=1', { waitUntil: 'load' });
  await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
  return { context, page };
}

async function readButtonStyles(locator: Locator): Promise<ButtonStyles> {
  return locator.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderTopColor: styles.borderTopColor,
      borderTopStyle: styles.borderTopStyle,
      borderTopWidth: styles.borderTopWidth,
      boxShadow: styles.boxShadow,
      color: styles.color,
      cursor: styles.cursor,
      outlineStyle: styles.outlineStyle,
    };
  });
}

async function nearestOpaqueAncestorBackground(locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    let current = element.parentElement;
    while (current !== null) {
      const backgroundColor = getComputedStyle(current).backgroundColor;
      const slashAlphaMatch = /\/\s*(?<alpha>[.\d]+)%?\s*\)?$/.exec(backgroundColor);
      const commaAlphaMatch = /rgba?\([^,]+,[^,]+,[^,]+,\s*(?<alpha>[.\d]+)\)/.exec(
        backgroundColor,
      );
      const slashAlpha = slashAlphaMatch?.groups?.['alpha'];
      const commaAlpha = commaAlphaMatch?.groups?.['alpha'];
      const isTransparent =
        backgroundColor === 'transparent' ||
        (slashAlpha !== undefined && Number.parseFloat(slashAlpha) === 0) ||
        (commaAlpha !== undefined && Number.parseFloat(commaAlpha) === 0);
      if (!isTransparent) return backgroundColor;
      current = current.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  });
}

function hasVisibleAlpha(color: string): boolean {
  if (color === 'transparent') return false;
  const slashAlphaMatch = /\/\s*(?<alpha>[.\d]+)%?\s*\)?$/.exec(color);
  if (slashAlphaMatch?.groups?.['alpha'] !== undefined) {
    return Number.parseFloat(slashAlphaMatch.groups['alpha']) > 0;
  }
  const commaAlphaMatch = /rgba?\([^,]+,[^,]+,[^,]+,\s*(?<alpha>[.\d]+)\)/.exec(color);
  if (commaAlphaMatch?.groups?.['alpha'] !== undefined) {
    return Number.parseFloat(commaAlphaMatch.groups['alpha']) > 0;
  }
  return true;
}

function hasTransparentAlpha(color: string): boolean {
  return !hasVisibleAlpha(color);
}

async function expectVisibleRestingChrome(
  locator: Locator,
  options: { expectBackgroundContrast?: boolean } = { expectBackgroundContrast: true },
): Promise<ButtonStyles> {
  const styles = await readButtonStyles(locator);
  const ancestorBackground = await nearestOpaqueAncestorBackground(locator);

  expect(styles.borderTopWidth).toBe('1px');
  expect(styles.borderTopStyle).toBe('solid');
  expect(hasVisibleAlpha(styles.borderTopColor)).toBe(true);
  expect(hasVisibleAlpha(styles.backgroundColor)).toBe(true);
  expect(styles.borderTopColor).not.toBe(ancestorBackground);
  if (options.expectBackgroundContrast !== false) {
    expect(styles.backgroundColor).not.toBe(ancestorBackground);
  }

  return styles;
}

test.describe('Button ghost icon-only affordance', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`rest, hover, focus, and disabled states stay visible in ${theme} mode`, async ({
      browser,
    }) => {
      const { context, page } = await openButtonPage(browser, theme);
      try {
        const ghost = page.getByTestId('button-ghost-icon-only-rest');
        const ghostDanger = page.getByTestId('button-ghost-danger-icon-only-rest');
        const textGhost = page.getByTestId('button-ghost-text-share');

        const ghostRest = await expectVisibleRestingChrome(ghost);
        const ghostDangerRest = await expectVisibleRestingChrome(ghostDanger);

        const textGhostStyles = await readButtonStyles(textGhost);
        expect(hasTransparentAlpha(textGhostStyles.backgroundColor)).toBe(true);
        expect(hasTransparentAlpha(textGhostStyles.borderTopColor)).toBe(true);

        await ghost.hover();
        const ghostHover = await readButtonStyles(ghost);
        expect(ghostHover.backgroundColor).not.toBe(ghostRest.backgroundColor);
        expect(hasVisibleAlpha(ghostHover.borderTopColor)).toBe(true);

        await ghostDanger.hover();
        const ghostDangerHover = await readButtonStyles(ghostDanger);
        expect(ghostDangerHover.backgroundColor).not.toBe(ghostDangerRest.backgroundColor);
        expect(hasVisibleAlpha(ghostDangerHover.borderTopColor)).toBe(true);

        await ghost.focus();
        const focusedGhostStyles = await readButtonStyles(ghost);
        expect(focusedGhostStyles.boxShadow).not.toBe('none');

        await ghostDanger.focus();
        const focusedGhostDangerStyles = await readButtonStyles(ghostDanger);
        expect(focusedGhostDangerStyles.boxShadow).not.toBe('none');

        for (const testId of [
          'button-ghost-icon-only-disabled',
          'button-ghost-danger-icon-only-disabled',
          'button-ghost-icon-only-aria-disabled-link',
          'button-ghost-danger-icon-only-aria-disabled-link',
        ]) {
          const disabledStyles = await expectVisibleRestingChrome(page.getByTestId(testId));
          expect(disabledStyles.cursor).toBe('not-allowed');
        }
      } finally {
        await context.close();
      }
    });
  }

  test('forced-colors mode keeps icon-only ghost buttons bordered and focusable', async ({
    browser,
  }) => {
    const { context, page } = await openButtonPage(browser, 'light', { forcedColors: 'active' });
    try {
      for (const testId of ['button-ghost-icon-only-rest', 'button-ghost-danger-icon-only-rest']) {
        const button = page.getByTestId(testId);
        await expectVisibleRestingChrome(button, { expectBackgroundContrast: false });
        await button.focus();
        const focusedStyles = await readButtonStyles(button);
        expect(focusedStyles.outlineStyle).toBe('solid');
      }
    } finally {
      await context.close();
    }
  });
});
