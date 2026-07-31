import { expect, test } from '../src/fixtures/component-page.ts';
import { loadManifest, VIEWPORTS } from '../src/helpers/manifest.ts';
import { captureScreenshot } from '../src/helpers/screenshot.ts';

const desktop = VIEWPORTS.find((viewport) => viewport.name === 'desktop');
const mobile = VIEWPORTS.find((viewport) => viewport.name === 'mobile');
const megaMenuEntry = loadManifest().find((entry) => entry.slug === 'mega-menu');

if (!megaMenuEntry) {
  throw new Error('Cached testing manifest does not include slug "mega-menu".');
}

if (!desktop) {
  throw new Error('Desktop viewport fixture is missing.');
}

if (!mobile) {
  throw new Error('Mobile viewport fixture is missing.');
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

  const components = page.locator('a[href="/components"]');
  await expect(components).toBeFocused();
  await components.press('Tab');

  const designTokens = page.locator('a[href="/tokens"]');
  await expect(designTokens).toBeFocused();
  await designTokens.press('Tab');

  const frontend = page.getByRole('button', { name: 'Frontend' });
  await expect(frontend).toBeFocused();

  await frontend.press('ArrowDown');
  const backend = page.getByRole('button', { name: 'Backend' });
  await expect(backend).toBeFocused();

  await backend.press('ArrowRight');
  const apis = page.getByRole('link', { name: 'APIs' });
  await expect(apis).toBeFocused();

  await captureScreenshot(page, {
    slug: 'mega-menu',
    theme: 'light',
    viewport: 'desktop',
    fixture: 'nested-open',
  });

  await apis.press('ArrowLeft');
  await expect(backend).toBeFocused();

  await backend.press('Escape');
  await expect(products).toBeFocused();
  await expect(page.locator('.cinder-mega-menu__content')).toHaveCount(0);
});

test('mobile submenu layout preserves lateral navigation without overflowing', async ({
  componentPage,
}) => {
  const page = await componentPage.open({
    entry: megaMenuEntry,
    theme: 'light',
    viewport: mobile,
  });

  await page.getByRole('button', { name: 'Products' }).click();
  const frontend = page.getByRole('button', { name: 'Frontend' });
  await frontend.focus();
  await frontend.press('ArrowDown');
  const backend = page.getByRole('button', { name: 'Backend' });
  await expect(backend).toBeFocused();
  await backend.press('ArrowRight');
  await expect(page.getByRole('link', { name: 'APIs' })).toBeFocused();

  const layout = await page.locator('.cinder-mega-menu__sub').evaluate((submenu) => {
    const list = submenu.querySelector('.cinder-mega-menu__submenu-list')?.getBoundingClientRect();
    const panel = submenu
      .querySelector('.cinder-mega-menu__submenu-panel')
      ?.getBoundingClientRect();
    if (!list || !panel) throw new Error('Missing nested submenu layout regions.');
    return {
      panelIsLateral: panel.left >= list.right,
      viewportOverflows:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  expect(layout).toEqual({ panelIsLateral: true, viewportOverflows: false });
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
  const shortcutLayout = await keyList.evaluate((list) => {
    const alternatives = Array.from(list.querySelectorAll('.dx-keys__alternative'));
    const ungroupedSeparators = alternatives.some((group) => {
      const separator = group.querySelector('.dx-keys__separator');
      const key = group.querySelector('.cinder-kbd');
      return !separator || !key || separator.parentElement !== group || key.parentElement !== group;
    });
    const keys = Array.from(list.querySelectorAll<HTMLElement>('.cinder-kbd'));
    const overflows = keys.some((key) => {
      return key.scrollHeight > key.clientHeight || key.scrollWidth > key.clientWidth;
    });
    list.closest('#accessibility')?.scrollIntoView({ block: 'start' });
    return {
      alternativeCount: alternatives.length,
      directSeparatorCount: list.querySelectorAll(':scope > .dx-keys__separator').length,
      ungroupedSeparators,
      overflows,
    };
  });
  expect(shortcutLayout).toEqual({
    alternativeCount: 5,
    directSeparatorCount: 0,
    ungroupedSeparators: false,
    overflows: false,
  });

  await captureScreenshot(page, {
    slug: 'mega-menu',
    theme: 'light',
    viewport: 'desktop',
    fixture: 'accessibility',
  });
});
