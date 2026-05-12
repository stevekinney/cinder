import { test as base, type BrowserContext, type Page } from '@playwright/test';
import type { ComponentEntry, Theme, Viewport } from '../helpers/manifest.ts';
import { THEME_STORAGE_KEY, themeContextOptions } from '../helpers/theme.ts';

export type OpenArgs = { entry: ComponentEntry; theme: Theme; viewport: Viewport };
export type ComponentPage = {
  open(args: OpenArgs): Promise<Page>;
};

type Fixtures = { componentPage: ComponentPage };

export const test = base.extend<Fixtures>({
  componentPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];

    const componentPage: ComponentPage = {
      async open({ entry, theme, viewport }) {
        const baseURL = process.env['PLAYGROUND_URL'] ?? 'http://localhost:4173';
        const context = await browser.newContext({
          ...themeContextOptions(theme),
          viewport: { width: viewport.width, height: viewport.height },
          baseURL,
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
        contexts.push(context);
        const page = await context.newPage();
        await page.goto(entry.route, { waitUntil: 'load' });
        await page.waitForSelector('#app > *', { state: 'visible', timeout: 15_000 });
        return page;
      },
    };

    await use(componentPage);

    for (const ctx of contexts) {
      try {
        await ctx.close();
      } catch {
        /* ignore */
      }
    }
  },
});

export { expect } from '@playwright/test';
