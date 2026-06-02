import { expect, test, type Locator, type Page } from '@playwright/test';

const PIXEL_TOLERANCE = 0.5;

type ComputedMetrics = {
  appearance: string;
  borderBlockStartWidth: number;
  borderRadius: number;
  display: string;
  flexDirection: string;
  height: number;
  listStyleType: string;
  paddingInlineStart: number;
  width: number;
};

async function computedMetrics(locator: Locator): Promise<ComputedMetrics> {
  return locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error('Expected an HTMLElement');
    }
    const styles = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      appearance: styles.appearance,
      borderBlockStartWidth: Number.parseFloat(
        styles.borderBlockStartWidth || styles.borderTopWidth,
      ),
      borderRadius: Number.parseFloat(styles.borderStartStartRadius || styles.borderRadius),
      display: styles.display,
      flexDirection: styles.flexDirection,
      height: rect.height,
      listStyleType: styles.listStyleType,
      paddingInlineStart: Number.parseFloat(styles.paddingInlineStart || styles.paddingLeft),
      width: rect.width,
    };
  });
}

async function waitForShellLayout(page: Page): Promise<void> {
  await page.waitForSelector('#viewport-preset.cinder-segmented-control', { state: 'visible' });
  await page.waitForSelector('#sidebar-filter.cinder-input', { state: 'visible' });
  await page.waitForSelector('.cinder-side-navigation__list', { state: 'visible' });
  await page.waitForFunction(() => {
    const control = document.querySelector('#viewport-preset.cinder-segmented-control');
    const option = document.querySelector('#viewport-preset .cinder-segmented-control-option');
    const sidebarList = document.querySelector('.cinder-side-navigation__list');
    const filter = document.querySelector('#sidebar-filter.cinder-input');
    return [control, option, sidebarList, filter].every(
      (element) => element instanceof HTMLElement && element.getBoundingClientRect().height > 0,
    );
  });
}

test.describe('playground shell styles', () => {
  test('outer shell chrome loads Cinder component styles', async ({ page }, testInfo) => {
    await page.goto('/c/slider', { waitUntil: 'load' });
    await waitForShellLayout(page);

    const viewportControl = page.locator('#viewport-preset.cinder-segmented-control');
    const viewportOption = viewportControl.locator('.cinder-segmented-control-option').first();
    const sidebarList = page.locator('.cinder-side-navigation__list');
    const filterInput = page.locator('#sidebar-filter.cinder-input');

    const viewportMetrics = await computedMetrics(viewportControl);
    expect(['flex', 'inline-flex']).toContain(viewportMetrics.display);
    expect(viewportMetrics.borderBlockStartWidth).toBeGreaterThan(0);
    expect(viewportMetrics.borderRadius).toBeGreaterThan(0);

    const optionMetrics = await computedMetrics(viewportOption);
    expect(['flex', 'inline-flex']).toContain(optionMetrics.display);
    expect(optionMetrics.paddingInlineStart).toBeGreaterThanOrEqual(7.5);
    expect(optionMetrics.height).toBeGreaterThan(20);

    const sidebarMetrics = await computedMetrics(sidebarList);
    expect(sidebarMetrics.display).toBe('flex');
    expect(sidebarMetrics.flexDirection).toBe('column');
    expect(sidebarMetrics.listStyleType).toBe('none');

    const filterMetrics = await computedMetrics(filterInput);
    expect(filterMetrics.appearance).toBe('none');
    expect(filterMetrics.borderBlockStartWidth).toBeGreaterThan(0);
    expect(filterMetrics.borderRadius).toBeGreaterThan(0);
    expect(filterMetrics.height).toBeGreaterThan(30);

    await page.getByRole('radio', { name: 'Tablet (768 pixels)' }).click();
    await expect(viewportControl.locator('[data-cinder-selected]')).toContainText('Tablet');

    const numberInput = page.locator('.cinder-number-input:has(#viewport-width-input)');
    const numberInputMetrics = await computedMetrics(numberInput);
    expect(['flex', 'inline-flex']).toContain(numberInputMetrics.display);
    expect(numberInputMetrics.borderBlockStartWidth).toBeGreaterThan(0);
    expect(numberInputMetrics.borderRadius).toBeGreaterThan(0);

    const customWidth = page.getByLabel('Custom viewport width in pixels (200 to 3840)');
    await customWidth.fill('640');
    await customWidth.blur();
    await expect(customWidth).toHaveValue('640');

    await page.getByRole('radio', { name: 'Dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-cinder-theme', 'dark');

    // The narrow-viewport sidebar toggle is in the DOM but display:none at this
    // wide width (so getByRole, which excludes hidden nodes, would not see it).
    // Assert it exists and carries the right a11y wiring without requiring it to
    // be visible here; its open/close behaviour is unit-tested in top-bar.test.ts.
    const sidebarToggle = page.locator('.sidebar-toggle');
    await expect(sidebarToggle).toHaveAttribute('aria-label', 'Toggle component list');
    await expect(sidebarToggle).toHaveCSS('display', 'none');

    const focusModeButton = page.getByRole('button', { name: /Focus mode/ });
    await focusModeButton.click();
    await expect(page.locator('.shell')).toHaveClass(/focus-mode/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.shell')).not.toHaveClass(/focus-mode/);

    const navigationItems = page.locator('.cinder-side-navigation__item');
    const unfilteredNavigationCount = await navigationItems.count();
    await filterInput.fill('slider');
    await expect(page.locator('a[href="/c/slider"]')).toBeVisible();
    await expect(page.locator('a[href="/c/button"]')).toHaveCount(0);
    await expect(navigationItems).not.toHaveCount(unfilteredNavigationCount);

    await page.screenshot({
      path: testInfo.outputPath('playground-shell-styles-slider.png'),
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
    });

    const filteredSidebarMetrics = await computedMetrics(sidebarList);
    expect(Math.abs(filteredSidebarMetrics.width - sidebarMetrics.width)).toBeLessThanOrEqual(
      PIXEL_TOLERANCE,
    );
  });
});
