import { test as base, type BrowserContext, type Page } from '@playwright/test';
import type { ComponentEntry, Theme, Viewport } from '../helpers/manifest.ts';
import { PLAYGROUND_URL } from '../helpers/playground-url.ts';
import { THEME_STORAGE_KEY, themeContextOptions } from '../helpers/theme.ts';

export type OpenArgs = { entry: ComponentEntry; theme: Theme; viewport: Viewport };
export type ComponentPage = {
  open(args: OpenArgs): Promise<Page>;
};

type Fixtures = { componentPage: ComponentPage };

/**
 * Append `?snapshot=1` to a route URL, merging it into any existing query
 * string. The `snapshot` param takes priority over any existing value with
 * that key (there should be none in practice, but merging is safer than
 * concatenating with `?` vs `&` conditionally).
 */
function withSnapshotParam(route: string): string {
  const [path, existingSearch] = route.split('?') as [string, string | undefined];
  const params = new URLSearchParams(existingSearch ?? '');
  params.set('snapshot', '1');
  return `${path}?${params.toString()}`;
}

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
        // Navigate with ?snapshot=1 to activate deterministic rendering:
        // zeroed animation/transition durations, transparent carets, and
        // data-snapshot-mode on <html>. This is the Phase 1 determinism
        // foundation — all visual captures go through snapshot mode so
        // screenshots are stable across repeated runs.
        await page.goto(withSnapshotParam(entry.route), { waitUntil: 'load' });
        // Post-#39 (chunk-[hash].js naming), all components — including the
        // Milkdown-backed editors (Chat, MarkdownEditor, ReviewEditor) —
        // mount in single-digit seconds on the CI runner. 20s leaves
        // generous headroom for runAxe + captureScreenshot inside the
        // per-test 90s timeout.
        await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
        // Blur any auto-focused element so focus rings don't appear in
        // screenshots. Phase 2 interaction tokens will opt back in to focus
        // on specific elements when the visual contract requires it.
        // Use string form to avoid a TypeScript dom-lib dependency; runs in
        // the browser context.
        await page.evaluate(
          'const a = document.activeElement; if (a && typeof a.blur === "function") a.blur();',
        );
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
