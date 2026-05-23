import { expect, test } from '../src/fixtures/component-page.ts';
import { runAxe } from '../src/helpers/axe.ts';
import { loadManifest } from '../src/helpers/manifest.ts';

const entriesBySlug = new Map(loadManifest().map((entry) => [entry.slug, entry] as const));
const desktopViewport = { name: 'desktop', width: 1440, height: 1080 } as const;
const mobileViewport = { name: 'mobile', width: 390, height: 844 } as const;
const lightTheme = 'light' as const;

function getEntry(slug: string) {
  const entry = entriesBySlug.get(slug);
  if (!entry) {
    throw new Error(`Component manifest is missing slug: ${slug}`);
  }
  return entry;
}

function expectNoViolations(
  component: string,
  fixture: string,
  buckets: Awaited<ReturnType<typeof runAxe>>,
) {
  const violations = Object.values(buckets).flat();
  expect(violations, `${component}/${fixture} should have no scoped axe violations`).toHaveLength(
    0,
  );
}

test.describe('a11y regressions', () => {
  test('section-heading uses div roots without header landmarks', async ({ componentPage }) => {
    const page = await componentPage.open({
      entry: getEntry('section-heading'),
      theme: lightTheme,
      viewport: desktopViewport,
      fixtureName: 'basic',
    });

    const rootSelector = '#example-mount-basic';
    await expect(page.locator('.cinder-section-heading')).toHaveCount(1);
    await expect(page.locator('.cinder-section-heading')).toHaveJSProperty('tagName', 'DIV');
    expect(await page.locator(`${rootSelector} header`).count()).toBe(0);

    const buckets = await runAxe(
      page,
      {
        slug: 'section-heading',
        theme: lightTheme,
        viewport: desktopViewport.name,
        fixture: 'basic',
      },
      { include: rootSelector },
    );
    expectNoViolations('section-heading', 'default', buckets);
  });

  test('dropdown grouped example exposes labelled groups', async ({ componentPage }) => {
    const page = await componentPage.open({
      entry: getEntry('dropdown'),
      theme: lightTheme,
      viewport: desktopViewport,
      fixtureName: 'with-label',
    });

    const mountSelector = '#example-mount-with-label';
    await page.getByRole('button', { name: 'Grouped menu' }).click();
    await expect(page.locator('#dropdown-with-label-menu')).toBeVisible();
    await expect(
      page.locator('#dropdown-with-label-menu [role="group"][aria-labelledby]'),
    ).toHaveCount(2);
    await expect(page.locator('#dropdown-with-label-document')).toContainText('Document');

    const buckets = await runAxe(
      page,
      {
        slug: 'dropdown',
        theme: lightTheme,
        viewport: desktopViewport.name,
        fixture: 'with-label',
      },
      { include: [mountSelector, '#dropdown-with-label-menu'] },
    );
    expectNoViolations('dropdown', 'with-label', buckets);
  });

  test('color-picker selected swatch shows an indicator without forced focus', async ({
    componentPage,
  }) => {
    const page = await componentPage.open({
      entry: getEntry('color-picker'),
      theme: lightTheme,
      viewport: desktopViewport,
      fixtureName: 'basic',
    });

    const rootSelector = '#example-mount-basic';
    const selectedSwatch = page
      .locator('.cinder-color-picker__swatch[data-cinder-selected]')
      .first();
    await expect(selectedSwatch).toBeVisible();
    await expect(selectedSwatch.locator('svg')).toHaveCount(1);
    await expect(selectedSwatch).not.toBeFocused();

    const buckets = await runAxe(
      page,
      {
        slug: 'color-picker',
        theme: lightTheme,
        viewport: desktopViewport.name,
        fixture: 'basic',
      },
      { include: rootSelector },
    );
    expectNoViolations('color-picker', 'default', buckets);
  });

  test('navigation-bar toggle is named by aria-label and hides its glyph', async ({
    componentPage,
  }) => {
    const page = await componentPage.open({
      entry: getEntry('navigation-bar'),
      theme: lightTheme,
      viewport: mobileViewport,
      fixtureName: 'basic',
    });

    const rootSelector = '#example-mount-basic';
    const toggle = page.getByRole('button', { name: 'Open menu' });
    await expect(toggle).toBeVisible();
    await expect(toggle.locator('span[aria-hidden="true"]')).toContainText('☰');

    const buckets = await runAxe(
      page,
      {
        slug: 'navigation-bar',
        theme: lightTheme,
        viewport: mobileViewport.name,
        fixture: 'basic',
      },
      { include: rootSelector },
    );
    expectNoViolations('navigation-bar', 'default', buckets);
  });
});
