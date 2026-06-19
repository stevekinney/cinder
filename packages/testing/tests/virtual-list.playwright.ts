import { expect, test } from '../src/fixtures/component-page.ts';
import { runAxe, type AxeBuckets } from '../src/helpers/axe.ts';
import { loadManifest } from '../src/helpers/manifest.ts';

const entriesBySlug = new Map(loadManifest().map((entry) => [entry.slug, entry] as const));
const desktopViewport = { name: 'desktop', width: 1280, height: 900 } as const;
const lightTheme = 'light' as const;

function getEntry(slug: string) {
  const entry = entriesBySlug.get(slug);
  if (!entry) throw new Error(`Component manifest is missing slug: ${slug}`);
  return entry;
}

function axeViolations(buckets: AxeBuckets): unknown[] {
  return Object.values(buckets).flat();
}

test.describe('Virtualized list examples', () => {
  test('virtual-list keeps the 10k-row example windowed and axe-clean', async ({
    componentPage,
  }) => {
    const page = await componentPage.open({
      entry: getEntry('virtual-list'),
      theme: lightTheme,
      viewport: desktopViewport,
    });
    const mountSelector = '#example-mount-ten-thousand';
    const list = page.locator(`${mountSelector} .cinder-virtual-list`);
    const rows = page.locator(`${mountSelector} [data-cinder-virtual-index]`);

    await expect(list).toBeVisible();
    await expect.poll(() => rows.count()).toBeGreaterThan(0);
    await expect.poll(() => rows.count()).toBeLessThan(40);

    const buckets = await runAxe(
      page,
      {
        slug: 'virtual-list',
        theme: lightTheme,
        viewport: desktopViewport.name,
        fixture: 'ten-thousand',
      },
      { include: mountSelector },
    );
    expect(axeViolations(buckets)).toEqual([]);
  });

  test('data-table virtualized example keeps native table semantics and is axe-clean', async ({
    componentPage,
  }) => {
    const page = await componentPage.open({
      entry: getEntry('data-table'),
      theme: lightTheme,
      viewport: desktopViewport,
    });
    const mountSelector = '#example-mount-virtualized';
    const table = page.locator(`${mountSelector} table`);
    const bodyRows = page.locator(`${mountSelector} tbody tr:not([aria-hidden="true"])`);

    await expect(table).toBeVisible();
    await expect(table).toHaveAttribute('aria-rowcount', '10001');
    await expect(page.locator(`${mountSelector} thead th[scope="col"]`)).toHaveCount(4);
    await expect.poll(() => bodyRows.count()).toBeGreaterThan(0);
    await expect.poll(() => bodyRows.count()).toBeLessThan(40);

    const buckets = await runAxe(
      page,
      {
        slug: 'data-table',
        theme: lightTheme,
        viewport: desktopViewport.name,
        fixture: 'virtualized',
      },
      { include: mountSelector },
    );
    expect(axeViolations(buckets)).toEqual([]);
  });
});
