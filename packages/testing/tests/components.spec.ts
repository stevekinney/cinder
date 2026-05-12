import { createHash } from 'node:crypto';

import { expect, test } from '../src/fixtures/component-page.ts';
import { runAxe } from '../src/helpers/axe.ts';
import { loadManifest, manifestDigest, THEMES, VIEWPORTS } from '../src/helpers/manifest.ts';
import { captureScreenshot } from '../src/helpers/screenshot.ts';

test.describe('server identity', () => {
  test('cached manifest matches live /api/manifest', async ({ request }) => {
    // `request` honors playwright.config.ts's `use.baseURL`, which resolves
    // via `src/helpers/playground-url.ts`.
    const response = await request.get('/api/manifest');
    expect(response.ok()).toBeTruthy();

    const live = (await response.json()) as Array<{ name: string; kebabName: string }>;

    const liveEntries = live
      .map((entry) => ({ name: entry.name, route: `/page/${entry.kebabName}` }))
      .toSorted((a, b) => a.name.localeCompare(b.name));

    const liveDigest = createHash('sha256').update(JSON.stringify(liveEntries)).digest('hex');

    expect(
      liveDigest,
      [
        'Live manifest digest must match cached manifest digest.',
        'Re-run `bun run test:browser` to regenerate the cache.',
        '',
        `Live components:   ${live
          .map((entry) => entry.name)
          .toSorted()
          .join(', ')}`,
        `Cached components: ${loadManifest()
          .map((entry) => entry.name)
          .toSorted()
          .join(', ')}`,
      ].join('\n'),
    ).toBe(manifestDigest());
  });
});

const entries = loadManifest();

/**
 * Components whose `/page/<slug>` page-bundle either fails to build on CI
 * (Bun.build "Multiple files share the same output path" on Linux runners
 * for components transitively touching certain Svelte internals) or whose
 * mount completes slower than the fixture's `#app > *` wait window. These
 * pass reliably on local hardware but flake on the GitHub Actions runner.
 *
 * Skipped on CI only; tracked for a follow-up fix in the playground's lazy
 * `Bun.build` path that owns the page-bundle pipeline.
 */
const SLOW_ON_CI: ReadonlySet<string> = new Set([
  'code-block',
  'chat',
  'markdown-editor',
  'review-editor',
]);

const isCI = process.env['CI'] === 'true' || process.env['CI'] === '1';

for (const entry of entries) {
  test.describe(entry.name, () => {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const testCase = isCI && SLOW_ON_CI.has(entry.slug) ? test.skip : test;
        testCase(`${theme}-${viewport.name}`, async ({ componentPage }) => {
          const page = await componentPage.open({ entry, theme, viewport });

          const key = { slug: entry.slug, theme, viewport: viewport.name };

          const buckets = await runAxe(page, key);

          test.info().annotations.push({
            type: 'axe',
            description: `C/S/M/m: ${buckets.critical.length}/${buckets.serious.length}/${buckets.moderate.length}/${buckets.minor.length}`,
          });

          await captureScreenshot(page, key);

          // v1: no assertions on axe buckets — record only.
        });
      }
    }
  });
}
