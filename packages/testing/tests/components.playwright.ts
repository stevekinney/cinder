import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, test } from '../src/fixtures/component-page.ts';
import { evaluateAxeGate } from '../src/helpers/axe-gate.ts';
import { runAxe } from '../src/helpers/axe.ts';
import { applyComponentFilter, parseComponentFilter } from '../src/helpers/component-filter.ts';
import { applyInteractions } from '../src/helpers/interact.ts';
import { loadManifest, manifestDigest, THEMES, VIEWPORTS } from '../src/helpers/manifest.ts';
import { captureScreenshot } from '../src/helpers/screenshot.ts';

test.describe('server identity', () => {
  test('cached manifest matches live standalone manifest', async ({ request }) => {
    // `request` honors playwright.config.ts's `use.baseURL`, which resolves
    // via `src/helpers/playground-url.ts`.
    const response = await request.get('/api/manifest?standalone=1');
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

test.describe('table scroll recipe', () => {
  test('keeps the semantic table in a horizontally scrollable wrapper with sticky header', async ({
    page,
  }) => {
    const tableCss = readFileSync(
      new URL('../../components/src/components/table/table.css', import.meta.url),
      'utf8',
    );

    await page.setContent(`
      <style>
        :root {
          --cinder-text-sm: 14px;
          --cinder-text: #111827;
          --cinder-text-muted: #4b5563;
          --cinder-surface: #ffffff;
          --cinder-surface-inset: #f9fafb;
          --cinder-border-muted: #d1d5db;
          --cinder-space-1: 0.25rem;
          --cinder-space-2: 0.5rem;
          --cinder-space-3: 0.75rem;
          --cinder-font-medium: 500;
        }
        ${tableCss}
        .fixture-scroll {
          inline-size: 260px;
          block-size: 140px;
          overflow: auto;
          border: 1px solid var(--cinder-border-muted);
        }
        .fixture-scroll .cinder-table {
          inline-size: 720px;
        }
        .fixture-scroll th,
        .fixture-scroll td {
          min-inline-size: 180px;
        }
      </style>
      <div class="fixture-scroll cinder-table-scroll" data-testid="table-scroll">
        <table class="cinder-table" data-cinder-sticky-header>
          <caption class="cinder-table__caption">Builds</caption>
          <thead class="cinder-table__header">
            <tr class="cinder-table__row">
              <th class="cinder-table__header-cell" scope="col">Project</th>
              <th class="cinder-table__header-cell" scope="col">Owner</th>
              <th class="cinder-table__header-cell" scope="col">Status</th>
              <th class="cinder-table__header-cell" scope="col">Updated</th>
            </tr>
          </thead>
          <tbody class="cinder-table__body">
            ${Array.from(
              { length: 16 },
              (_, index) => `
                <tr class="cinder-table__row">
                  <td class="cinder-table__cell">Package ${index}</td>
                  <td class="cinder-table__cell">Design Systems</td>
                  <td class="cinder-table__cell">Passing</td>
                  <td class="cinder-table__cell">Today</td>
                </tr>
              `,
            ).join('')}
          </tbody>
        </table>
      </div>
    `);

    const wrapper = page.getByTestId('table-scroll');
    const table = wrapper.locator('table.cinder-table');
    await expect(table).toHaveJSProperty('tagName', 'TABLE');

    const wrapperSizes = await wrapper.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));

    expect(wrapperSizes.scrollWidth).toBeGreaterThan(wrapperSizes.clientWidth);
    expect(wrapperSizes.scrollHeight).toBeGreaterThan(wrapperSizes.clientHeight);

    const header = wrapper.locator('.cinder-table__header');
    await expect(header).toHaveCSS('position', 'sticky');
    const wrapperBox = await wrapper.boundingBox();
    const before = await header.boundingBox();
    await wrapper.evaluate((element) => {
      element.scrollTop = 80;
      element.scrollLeft = 120;
    });
    await page.waitForTimeout(50);
    const after = await header.boundingBox();

    expect(wrapperBox).not.toBeNull();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after?.y ?? 0).toBeLessThan(before?.y ?? 0);
    expect(Math.abs((after?.y ?? 0) - (wrapperBox?.y ?? 0))).toBeLessThan(2);
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
            // Pass the fixture name so the playground renders with the
            // fixture's props via ?fixture=<name>. 'default' is omitted
            // (no query param) — the playground renders the component's
            // default state.
            const openArgs =
              fixture.name !== 'default'
                ? ({ entry, theme, viewport, fixtureName: fixture.name } as const)
                : ({ entry, theme, viewport } as const);
            const page = await componentPage.open(openArgs);

            const key = {
              slug: entry.slug,
              theme,
              viewport: viewport.name,
              fixture: fixture.name,
            };

            // Apply interaction steps (e.g. click trigger, focus input) before
            // capture so the screenshot shows the post-interaction state.
            if (
              'interact' in fixture &&
              Array.isArray(fixture.interact) &&
              fixture.interact.length > 0
            ) {
              await applyInteractions(page, fixture.interact);
            }

            const buckets = await runAxe(page, key);

            test.info().annotations.push({
              type: 'axe',
              description: `C/S/M/m: ${buckets.critical.length}/${buckets.serious.length}/${buckets.moderate.length}/${buckets.minor.length}`,
            });

            // Record the screenshot taxonomy so the (future) contact-sheet
            // tooling can group captures by intent (visual contract vs
            // interaction state vs primitive composition vs documentation).
            //
            // NOTE: today this resolves to 'visual-contract' for EVERY capture,
            // because the manifest pipeline (prepare-manifest.ts →
            // ComponentEntry.fixtures) does not yet carry `category`/`interact`,
            // so the sweep only ever sees the synthesized `default` fixture.
            // Threading category/interact through the manifest — so interaction
            // fixtures annotate as 'interaction-state' — is part of the deferred
            // fixture-rendering pipeline (see task b5af46f8). The annotation is
            // wired now so it goes live for free once that pipeline lands.
            const category =
              'category' in fixture && typeof fixture.category === 'string'
                ? fixture.category
                : 'visual-contract';
            test.info().annotations.push({ type: 'category', description: category });

            // Pass mask rules from the fixture so toHaveScreenshot can exclude
            // dynamic regions from the pixel comparison.
            const masks =
              'mask' in fixture && Array.isArray(fixture.mask) ? fixture.mask : undefined;
            await captureScreenshot(page, key, masks !== undefined ? { masks } : undefined);

            // Accessibility gate: `critical` and `serious` violations fail the
            // sweep; `moderate`/`minor` stay annotation-only (recorded above).
            // An entry in `AXE_ALLOW_LIST` (matched by slug, optionally narrowed
            // to theme/viewport/fixture) downgrades the specific rule ids it
            // names to an annotation so a known pre-existing violation can be
            // explicitly tracked rather than forcing a zero-violation baseline.
            // A blocking violation whose rule id is *not* allow-listed still
            // fails, so new regressions on allow-listed components are caught.
            const decision = evaluateAxeGate(key, buckets);
            if (decision.status === 'allowed') {
              test.info().annotations.push({
                type: 'axe-allowed',
                description: `Allow-listed blocking violation(s): ${decision.reason}`,
              });
            } else if (decision.status === 'fail') {
              expect(decision.violations, decision.message).toHaveLength(0);
            }
          });
        }
      }
    }
  });
}
