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
 * Open the inspector with ONE click.
 *
 * The landing shell stays un-hydrated until the reader asks for something, so
 * the toggle is server-rendered markup with no Svelte handler behind it. A
 * single click still has to work: `shell-entry.ts` intercepts the first one,
 * hydrates, and replays it into the now-live component.
 *
 * That is the whole contract, so the test asserts it directly instead of
 * retrying the click until one lands. A retry loop would let a broken
 * hydrate-and-replay path pass on a later click and hide the exact race this
 * covers — and the repository forbids adding a wait threshold in place of
 * fixing the synchronization (AGENTS.md, "test timeouts are not a fix").
 */
async function openInspector(page: Page) {
  await page.goto('/', { waitUntil: 'load' });
  const toggle = page.getByTestId('token-inspector-toggle');
  await expect(toggle).toBeVisible();

  await toggle.click();

  const panel = page.getByTestId('token-inspector-panel');
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  return panel;
}

/*
 * Not covered here: the stale-panel-load race that `shell.svelte`'s request
 * token guards against — two quick clicks while both panel chunks are uncached,
 * where the later-resolving import must not win.
 *
 * Three attempts at a browser test for it were each unsound in a different way.
 * Routing on a filename matched nothing, because chunks are content-hashed. A
 * catch-all chunk delay held one of `hydrateShell()`'s own imports instead, so
 * the ordering was accidental. Identifying the chunk by body content fixed the
 * targeting, but the assertion still has to run after the delayed module has
 * EVALUATED, and that moment has no observable signal — a frame-based yield is
 * too early, and a wall-clock wait is exactly what AGENTS.md forbids.
 *
 * Every version that was not simply inert passed with the guard reverted, which
 * makes it worse than no test: it would report the race as covered while
 * detecting nothing. The guard itself is three lines and was verified by hand
 * against a reverted build. Restoring coverage needs an observable
 * module-evaluation signal, not another wait.
 */
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

    /*
     * The row's two value columns have to agree with what the browser itself
     * resolves for that property in each theme — otherwise the panel could
     * render the right token set with wrong values and still pass.
     */
    const browserValues = await page.evaluate((property) => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:-9999px;visibility:hidden';
      document.body.append(probe);
      try {
        const read = (theme: string): string => {
          probe.dataset['theme'] = theme;
          return getComputedStyle(probe).getPropertyValue(property).trim();
        };
        return { light: read('light'), dark: read('dark') };
      } finally {
        probe.remove();
      }
    }, sample.cssProperty);

    expect(browserValues.light).not.toBe('');
    await expect(row.getByTestId('light-value')).toHaveText(browserValues.light);
    await expect(row.getByTestId('dark-value')).toHaveText(browserValues.dark);
  });

  test('rests inside the viewport with every column and the close control reachable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const panel = await openInspector(page);

    /*
     * Resting appearance, asserted as layout rather than as a screenshot: the
     * two regressions this actually caught during development were a Dark
     * column clipped past the panel's right edge and a panel pinned to full
     * height with ten rows in it. Both are geometry, so geometry is what gets
     * pinned — and unlike a baseline image this cannot be quietly re-recorded.
     */
    const panelBox = await panel.boundingBox();
    if (panelBox === null) throw new Error('panel has no box');

    const viewport = page.viewportSize();
    if (viewport === null) throw new Error('no viewport');
    expect(panelBox.x).toBeGreaterThanOrEqual(0);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width);
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(viewport.height);

    /* Every column header has to sit inside the panel, Dark included. */
    const headers = panel.locator('thead th');
    await expect(headers).toHaveCount(6);
    const headerBoxes = await headers.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, text: (element.textContent ?? '').trim() };
      }),
    );
    for (const header of headerBoxes) {
      expect(
        header.right,
        `column "${header.text}" is clipped past the panel's right edge`,
      ).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
    }

    /* The close control must be visible and actually hittable, not overlapped. */
    const close = panel.getByRole('button', { name: 'Close token inspector' });
    await expect(close).toBeVisible();
    const closeBox = await close.boundingBox();
    if (closeBox === null) throw new Error('close control has no box');
    const topmost = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'),
      { x: closeBox.x + closeBox.width / 2, y: closeBox.y + closeBox.height / 2 },
    );
    expect(topmost).toBe('Close token inspector');
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

  test('opening one token panel closes the other, and focus lands inside', async ({ page }) => {
    const panel = await openInspector(page);

    /*
     * Opening moves focus into the panel. The trigger is underneath a fixed
     * overlay once it opens, so leaving focus there strands a keyboard user
     * outside the thing they just opened.
     */
    await expect(panel.getByLabel('Filter tokens')).toBeFocused();

    /*
     * Both panels are fixed to the same right-hand area, and both register a
     * window-level Escape listener. Letting them open together stacks them and
     * makes one Escape close both, racing their focus restorations.
     */
    await page.getByTestId('color-token-panel-toggle').click();
    await expect(page.getByTestId('color-token-panel')).toBeVisible();
    await expect(page.getByTestId('token-inspector-panel')).toHaveCount(0);

    await page.getByTestId('token-inspector-toggle').click();
    await expect(page.getByTestId('token-inspector-panel')).toBeVisible();
    await expect(page.getByTestId('color-token-panel')).toHaveCount(0);
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
