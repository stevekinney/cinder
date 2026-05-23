import { expect, test } from '../src/fixtures/component-page.ts';
import { loadManifest, VIEWPORTS, type Theme } from '../src/helpers/manifest.ts';

const themes: Theme[] = ['light', 'dark'];
const desktop = VIEWPORTS.find((viewport) => viewport.name === 'desktop');
const menuBarEntry = loadManifest().find((entry) => entry.slug === 'menu-bar');

if (!menuBarEntry) {
  throw new Error('Cached testing manifest does not include slug "menu-bar".');
}

if (!desktop) {
  throw new Error('Desktop viewport fixture is missing.');
}

test.describe('MenuBar open menu positioning', () => {
  for (const theme of themes) {
    test(`${theme} File menu and submenu are visible and adjacent`, async ({ componentPage }) => {
      const page = await componentPage.open({
        entry: menuBarEntry,
        theme,
        viewport: desktop,
      });

      await page.getByRole('menuitem', { name: 'File' }).click();
      await page.getByRole('menuitem', { name: 'Open Recent' }).click();

      const submenuTrigger = page.getByRole('menuitem', { name: 'Open Recent' });
      const submenu = page.locator('.cinder-menu-bar__submenu-menu').first();
      await expect(submenuTrigger).toBeVisible();
      await expect(submenu).toBeVisible();

      const topLevelBox = await submenuTrigger.boundingBox();
      const submenuBox = await submenu.boundingBox();
      expect(topLevelBox, 'Open Recent trigger must have a visible bounding box.').not.toBeNull();
      expect(submenuBox, 'Open Recent submenu must have a visible bounding box.').not.toBeNull();

      const expectedSubmenuStart = topLevelBox!.x + topLevelBox!.width;
      expect(Math.abs(submenuBox!.x - expectedSubmenuStart)).toBeLessThanOrEqual(8);
      expect(submenuBox!.width).toBeGreaterThan(0);
      expect(submenuBox!.height).toBeGreaterThan(0);
    });
  }
});
