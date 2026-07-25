import { expect, test } from '../src/fixtures/component-page.ts';
import { loadManifest, VIEWPORTS } from '../src/helpers/manifest.ts';
import { captureScreenshot } from '../src/helpers/screenshot.ts';

const desktop = VIEWPORTS.find((viewport) => viewport.name === 'desktop');
const megaMenuEntry = loadManifest().find((entry) => entry.slug === 'mega-menu');

if (!megaMenuEntry) {
  throw new Error('Cached testing manifest does not include slug "mega-menu".');
}

if (!desktop) {
  throw new Error('Desktop viewport fixture is missing.');
}

test('nested submenu keyboard navigation enters, traverses, and exits', async ({
  componentPage,
}) => {
  const page = await componentPage.open({
    entry: megaMenuEntry,
    theme: 'light',
    viewport: desktop,
  });

  const products = page.getByRole('button', { name: 'Products' });
  await products.focus();
  await products.press('ArrowDown');

  const frontend = page.getByRole('button', { name: 'Frontend' });
  await expect(frontend).toBeFocused();

  await frontend.press('ArrowDown');
  const backend = page.getByRole('button', { name: 'Backend' });
  await expect(backend).toBeFocused();

  await backend.press('ArrowRight');
  const apis = page.getByRole('link', { name: 'APIs' });
  await expect(apis).toBeFocused();

  await apis.press('ArrowLeft');
  await expect(backend).toBeFocused();

  await backend.press('Escape');
  await expect(products).toBeFocused();
  await expect(page.locator('.cinder-mega-menu__content')).toHaveCount(0);
});

test('Accessibility shortcut alternatives wrap without overflowing', async ({ componentPage }) => {
  const page = await componentPage.open({
    entry: megaMenuEntry,
    theme: 'light',
    viewport: desktop,
  });
  // Snapshot mode intentionally renders only the component fixture, so switch to the
  // documentation route before checking the Accessibility section. captureScreenshot()
  // applies the repository's deterministic screenshot styling before it records the page.
  await page.goto(megaMenuEntry.route, { waitUntil: 'load' });

  const accessibility = page.locator('#accessibility');
  const keyList = accessibility.locator('.dx-keys__key-list');
  await expect(keyList.locator('.cinder-kbd')).toHaveCount(6);

  const overflows = await keyList.locator('.cinder-kbd').evaluateAll((keys) =>
    keys.some((key) => {
      const keyBox = key.getBoundingClientRect();
      const listBox = key.parentElement?.getBoundingClientRect();
      return listBox === undefined || keyBox.left < listBox.left || keyBox.right > listBox.right;
    }),
  );
  expect(overflows).toBe(false);

  await captureScreenshot(page, {
    slug: 'mega-menu',
    theme: 'light',
    viewport: 'desktop',
    fixture: 'accessibility',
  });
});
