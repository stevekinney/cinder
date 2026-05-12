import { createHash } from 'node:crypto';

import { expect, test } from '../src/fixtures/component-page.ts';
import { runAxe } from '../src/helpers/axe.ts';
import { loadManifest, manifestDigest, THEMES, VIEWPORTS } from '../src/helpers/manifest.ts';
import { captureScreenshot } from '../src/helpers/screenshot.ts';

test.describe('server identity', () => {
  test('cached manifest matches live /api/manifest', async ({ request }) => {
    // `request` honors playwright.config.ts's `use.baseURL`, which is
    // `process.env.PLAYGROUND_URL ?? 'http://localhost:4173'`.
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

for (const entry of entries) {
  test.describe(entry.name, () => {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        test(`${theme}-${viewport.name}`, async ({ componentPage }) => {
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
