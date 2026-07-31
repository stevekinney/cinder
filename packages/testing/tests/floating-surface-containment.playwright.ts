import { expect, test } from '@playwright/test';

async function clipComponent(page: import('@playwright/test').Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((component) => {
      const host = component.parentElement;
      if (!host) throw new Error(`Missing host for ${component.className}`);
      host.style.overflow = 'hidden';
      host.style.maxHeight = '3rem';
      host.dataset['containmentFixture'] = 'true';
      const bounds = host.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom };
    });
}

test.describe('floating surfaces escape component containment', () => {
  test('SpeedDial closed surface has no floating chrome', async ({ page }) => {
    await page.goto('/page/speed-dial?snapshot=1', { waitUntil: 'load' });
    const actions = page.locator('.cinder-speed-dial__actions').first();
    const action = actions.locator('.cinder-speed-dial-action').first();

    await expect(actions).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(actions).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
    await expect(actions).toHaveCSS('box-shadow', 'none');
    await expect(actions).toHaveCSS('opacity', '1');
    await expect(actions).toHaveCSS('pointer-events', 'none');
    await expect(action).toHaveCSS('opacity', '0');
    await expect(action).toHaveCSS('pointer-events', 'none');
  });

  test('SpeedDial actions portal outside a clipping ancestor', async ({ page }) => {
    await page.goto('/page/speed-dial?snapshot=1', { waitUntil: 'load' });
    const clippingBounds = await clipComponent(page, '.cinder-speed-dial');

    await page.getByRole('button', { name: 'Quick actions' }).first().click();
    const actions = page
      .locator('body > .cinder-speed-dial__portal-scope > .cinder-speed-dial__actions')
      .first();
    await expect(actions).toBeVisible();
    const box = await actions.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y < clippingBounds.top || box!.y + box!.height > clippingBounds.bottom).toBe(true);
  });

  test('Combobox empty state uses the portaled options-panel path', async ({ page }) => {
    await page.goto('/page/combobox?snapshot=1', { waitUntil: 'load' });
    await clipComponent(page, '.cinder-combobox');

    const input = page.getByRole('combobox', { name: 'Favorite fruit' }).first();
    await input.fill('not-a-fruit');

    const emptyState = page
      .locator('body > .cinder-popover__portal-scope > .cinder-popover .cinder-combobox__empty')
      .first();
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toHaveText('No results');
  });

  test('NavigationBar mobile panel portals outside the bar surface', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/page/navigation-bar?snapshot=1', { waitUntil: 'load' });
    await clipComponent(page, '.cinder-navigation-bar');

    await page.getByRole('button', { name: 'Open menu' }).first().click();
    const panel = page
      .locator(
        'body > .cinder-navigation-bar__portal-scope > .cinder-navigation-bar__items[data-open="true"]',
      )
      .first();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Docs');
  });
});
