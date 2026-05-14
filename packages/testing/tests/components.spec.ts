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

const allEntries = loadManifest();

/**
 * Optional comma-separated allowlist of component slugs to run. When set, the
 * matrix is filtered to just those slugs — used by CI to scope the suite to
 * the components actually changed in a pull request. Whitespace and empty
 * entries are ignored; unknown slugs are surfaced as a hard failure so the
 * workflow's slug-extraction logic stays honest.
 */
const filterEnvironmentVariable = 'CINDER_TEST_COMPONENTS';
const filterRaw = process.env[filterEnvironmentVariable];
const filterSlugs =
  filterRaw === undefined
    ? null
    : new Set(
        filterRaw
          .split(',')
          .map((slug) => slug.trim())
          .filter((slug) => slug.length > 0),
      );

if (filterSlugs !== null) {
  const knownSlugs = new Set(allEntries.map((entry) => entry.slug));
  const unknown = [...filterSlugs].filter((slug) => !knownSlugs.has(slug));
  if (unknown.length > 0) {
    throw new Error(
      `${filterEnvironmentVariable} references unknown component slugs: ${unknown.join(
        ', ',
      )}. Known slugs: ${[...knownSlugs].toSorted().join(', ')}.`,
    );
  }
}

const entries =
  filterSlugs === null || filterSlugs.size === 0
    ? allEntries
    : allEntries.filter((entry) => filterSlugs.has(entry.slug));

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
