import { test as base, type BrowserContext, type Page } from '@playwright/test';
import type { ComponentEntry, Theme, Viewport } from '../helpers/manifest.ts';
import { PLAYGROUND_URL } from '../helpers/playground-url.ts';
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
        const context = await browser.newContext({
          ...themeContextOptions(theme),
          viewport: { width: viewport.width, height: viewport.height },
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
        contexts.push(context);
        const page = await context.newPage();
        await page.goto(entry.route, { waitUntil: 'load' });
        // Post-#39 (chunk-[hash].js naming), all components — including the
        // Milkdown-backed editors (Chat, MarkdownEditor, ReviewEditor) —
        // mount in single-digit seconds on the CI runner. 20s leaves
        // generous headroom for runAxe + captureScreenshot inside the
        // per-test 90s timeout. Set CINDER_MOUNT_TIMEOUT_MS to override
        // while debugging slow components.
        const mountTimeout = Number(process.env['CINDER_MOUNT_TIMEOUT_MS'] ?? 20_000);
        await page.waitForSelector('#app > *', { state: 'visible', timeout: mountTimeout });
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
