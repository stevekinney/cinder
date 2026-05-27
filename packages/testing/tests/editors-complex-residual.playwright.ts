/**
 * Browser coverage for the P7 editors-and-complex residual audit cleanup.
 *
 * Each slice lives in its own top-level `describe` block named for the slice so
 * the blocks remain independently removable. Slices target the existing
 * playground routes: /page/chat, /page/markdown-editor, /page/review-editor,
 * and /page/json-schema-editor.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';
import { THEME_STORAGE_KEY } from '../src/helpers/theme.ts';

/** Channel value of `--cinder-touch-target-min` (tokens-base.css). */
const TOUCH_TARGET_MIN = 44;

/** Parsed RGBA channel set, alpha defaulting to fully opaque. */
type Rgba = { r: number; g: number; b: number; a: number };

/** Parses a computed `rgb()` / `rgba()` color string into channels. */
function parseRgba(value: string): Rgba {
  const match = value.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)/i,
  );
  if (!match) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

/**
 * Opens a playground route in a fresh touch-capable context with the requested
 * theme pre-selected, and waits for the app to mount.
 */
async function openTouchPage(
  browser: Browser,
  route: string,
  theme: 'light' | 'dark',
): Promise<{ page: Page; dispose: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL: PLAYGROUND_URL,
    colorScheme: theme,
    reducedMotion: 'reduce',
    hasTouch: true,
    isMobile: true,
    viewport: { width: 414, height: 896 },
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
  await page.goto(route, { waitUntil: 'load' });
  await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
  return { page, dispose: () => context.close() };
}

test.describe('chat action buttons', () => {
  test('built-in action buttons have a visible resting affordance and touch-sized target', async ({
    browser,
  }) => {
    const { page, dispose } = await openTouchPage(browser, '/page/chat?snapshot=1', 'light');
    try {
      const copyButton = page.locator('.chat-message-copy').first();
      await expect(copyButton).toBeVisible();

      const styles = await copyButton.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
          background: computed.backgroundColor,
          border: computed.borderTopColor,
          color: computed.color,
        };
      });

      expect(parseRgba(styles.background).a).toBeGreaterThan(0);
      expect(parseRgba(styles.border).a).toBeGreaterThan(0);

      const box = await copyButton.boundingBox();
      expect(box).not.toBeNull();
      expect((box as { width: number }).width).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN - 0.5);
      expect((box as { height: number }).height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN - 0.5);

      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: () => Promise.resolve() },
        });
      });

      const restingColor = styles.color;
      await copyButton.click();
      const successButton = page.locator('.chat-message-copy-success').first();
      await expect(successButton).toBeVisible();
      const successColor = await successButton.evaluate(
        (element) => getComputedStyle(element).color,
      );
      expect(successColor).not.toBe(restingColor);
    } finally {
      await dispose();
    }
  });
});
