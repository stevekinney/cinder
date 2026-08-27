/// <reference lib="dom" />
/**
 * CIN-34: the token inspector shows GENERATED data and nothing else.
 *
 * "Playground token UI uses generated data only" is an acceptance criterion, and
 * it is the kind that rots quietly — someone adds one hand-written label, or a
 * hard-coded row for a token that was convenient at the time, and no drift gate
 * notices because none of them can see a Svelte template.
 *
 * So this asserts the panel's contents against the registry the package
 * publishes: the row count matches the registry exactly, and a token picked out
 * of the registry at runtime (rather than hard-coded here, which would be the
 * same mistake one level up) shows the property and both resolved values that
 * the browser reports for it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;

type RegistryEntry = { path: string; cssProperty: string };

/**
 * The registry as COMMITTED, read from disk rather than imported through the
 * package the panel imports.
 *
 * Reading the artifact independently is what gives the row-count assertion
 * teeth: if the panel ever grew a hand-authored row, or dropped one, the two
 * numbers would diverge. Importing the very module the panel imports would make
 * the comparison tautological instead.
 */
const REGISTRY_ENTRIES: RegistryEntry[] = (() => {
  const registryPath = join(
    import.meta.dirname,
    '..',
    '..',
    'components',
    'src',
    'tokens',
    'registry.generated.json',
  );
  const parsed: unknown = JSON.parse(readFileSync(registryPath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${registryPath} is not a JSON object.`);
  }
  const entries = Object.getOwnPropertyDescriptor(parsed, 'entries')?.value as unknown;
  if (!Array.isArray(entries)) throw new Error(`${registryPath} has no \`entries\` array.`);
  return entries as RegistryEntry[];
})();

/**
 * Open the inspector, tolerating a click that lands before hydration.
 *
 * The landing shell is server-rendered, so the toggle is present and "visible"
 * before Svelte has attached its handler — a plain click can hit the markup and
 * do nothing, which reads as a mysteriously absent panel rather than a timing
 * problem. Retrying the whole open is safe because the action is idempotent:
 * it clicks only while the toggle still reports collapsed, so a retry after a
 * successful open does nothing rather than toggling the panel back shut.
 */
async function openInspector(page: Page) {
  await page.goto('/', { waitUntil: 'load' });
  const toggle = page.getByTestId('token-inspector-toggle');
  await expect(toggle).toBeVisible();

  const panel = page.getByTestId('token-inspector-panel');
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await expect(panel).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  return panel;
}

test.describe('token inspector panel', () => {
  test('renders one row per registry entry, with values the browser agrees with', async ({
    page,
  }) => {
    const panel = await openInspector(page);
    const rows = panel.locator('tbody tr');

    expect(REGISTRY_ENTRIES.length).toBeGreaterThan(0);
    await expect(rows).toHaveCount(REGISTRY_ENTRIES.length);

    /*
     * Count alone would not notice a row rendering the wrong property, so every
     * rendered path is compared against the registry as a set — no sampling,
     * since the whole claim is that the panel shows the corpus and only the
     * corpus.
     */
    const renderedPaths = await rows.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).dataset['tokenPath'] ?? ''),
    );
    expect([...renderedPaths].sort()).toEqual(REGISTRY_ENTRIES.map((entry) => entry.path).sort());

    const sample = REGISTRY_ENTRIES[Math.floor(REGISTRY_ENTRIES.length / 2)];
    if (sample === undefined) throw new Error('registry has no entries');

    const row = panel.locator(`tbody tr[data-token-path="${sample.path}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.locator('td').first()).toHaveText(sample.cssProperty);
  });

  test('filters rows without inventing or losing tokens', async ({ page }) => {
    const panel = await openInspector(page);
    const rows = panel.locator('tbody tr');
    const before = await rows.count();

    await panel.getByLabel('Filter tokens').fill('accent');
    await expect.poll(async () => rows.count()).toBeLessThan(before);

    /*
     * Every surviving row must genuinely match — a filter that merely trimmed
     * the list would pass a count assertion on its own.
     */
    const paths = await rows.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).dataset['tokenPath'] ?? ''),
    );
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((path) => path.includes('accent'))).toBe(true);
  });

  test('reports each token in both themes, and theme-aware ones differ', async ({ page }) => {
    const panel = await openInspector(page);

    await panel.getByLabel('Filter tokens').fill('accent.solid');
    const row = panel.locator('tbody tr[data-token-path="accent.solid"]');
    await expect(row).toHaveCount(1);

    const light = (await row.getByTestId('light-value').innerText()).trim();
    const dark = (await row.getByTestId('dark-value').innerText()).trim();

    expect(light).not.toBe('');
    expect(dark).not.toBe('');

    /*
     * `accent.solid` is theme-aware, so the two columns disagreeing is the whole
     * point — equal values would mean the probe never actually switched themes
     * and the panel was reporting one theme twice.
     */
    await expect(row).toHaveAttribute('data-theme-aware', 'true');
    expect(light).not.toBe(dark);
  });
});
