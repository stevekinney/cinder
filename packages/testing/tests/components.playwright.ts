import { createHash } from 'node:crypto';

import { expect, test } from '../src/fixtures/component-page.ts';
import { runAxe } from '../src/helpers/axe.ts';
import { applyComponentFilter, parseComponentFilter } from '../src/helpers/component-filter.ts';
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

const allEntries = loadManifest();

// `CINDER_TEST_COMPONENTS` is a comma-separated allow-list set by CI when a
// pull request only touched specific components. See
// `scripts/changed-components.ts` for how the value is computed. Empty,
// whitespace, or unset all run the full matrix. Unknown slugs throw — the
// scope job's manifest validation should have caught them upstream, so a
// surprise here means the two are out of sync.
const knownSlugs = new Set(allEntries.map((entry) => entry.slug));
const filterSlugs = parseComponentFilter(process.env['CINDER_TEST_COMPONENTS'], knownSlugs);
const entries = applyComponentFilter(allEntries, filterSlugs);

/** The synthesised default fixture used when a component has no explicit fixture list. */
const DEFAULT_FIXTURE = [{ name: 'default' }] as const;

for (const entry of entries) {
  test.describe(entry.name, () => {
    // Use the entry's explicit fixture list when provided; otherwise synthesise a
    // single 'default' fixture so every component is exercised at least once.
    const fixtures =
      entry.fixtures !== undefined && entry.fixtures.length > 0 ? entry.fixtures : DEFAULT_FIXTURE;

    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        for (const fixture of fixtures) {
          test(`${theme}-${viewport.name}-${fixture.name}`, async ({ componentPage }) => {
            const page = await componentPage.open({ entry, theme, viewport });

            const key = {
              slug: entry.slug,
              theme,
              viewport: viewport.name,
              fixture: fixture.name,
            };

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
    }
  });
}
