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

/*
 * The shell survives only as the landing page at `/`. Component documentation
 * moved to `/page/<name>`, which carries its own chrome built from bare
 * elements, so the viewport SegmentedControl this helper used to await no
 * longer has a surface anywhere. What remains to verify here is the shell's
 * OWN cinder-component chrome: the side navigation and its filter input.
 */
async function waitForShellLayout(page: Page): Promise<void> {
  await page.waitForSelector('#sidebar-filter.cinder-input', { state: 'visible' });
  await page.waitForSelector('.cinder-side-navigation__list', { state: 'visible' });
  await page.waitForFunction(() => {
    const sidebarList = document.querySelector('.cinder-side-navigation__list');
    const filter = document.querySelector('#sidebar-filter.cinder-input');
    return [sidebarList, filter].every(
      (element) => element instanceof HTMLElement && element.getBoundingClientRect().height > 0,
    );
  });
}

test.describe('playground shell styles', () => {
  test('outer shell chrome loads Cinder component styles', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForShellLayout(page);

    const sidebarList = page.locator('.cinder-side-navigation__list');
    const filterInput = page.locator('#sidebar-filter.cinder-input');

    const sidebarMetrics = await computedMetrics(sidebarList);
    expect(sidebarMetrics.display).toBe('flex');
    expect(sidebarMetrics.flexDirection).toBe('column');
    expect(sidebarMetrics.listStyleType).toBe('none');

    const filterMetrics = await computedMetrics(filterInput);
    expect(filterMetrics.appearance).toBe('none');
    expect(filterMetrics.borderBlockStartWidth).toBeGreaterThan(0);
    expect(filterMetrics.borderRadius).toBeGreaterThan(0);
    expect(filterMetrics.height).toBeGreaterThan(30);

    // The landing shell renders README prose, not component documentation —
    // that surface moved to `/page/<name>` in full.
    await expect(page.locator('.landing-page__readme')).toBeVisible();
    /*
     * The iframe preview and the viewport/custom-width controls are gone: the
     * shell no longer renders component documentation, and the documentation
     * page mounts its preview inline with its own width control. What this test
     * still guarantees is the thing it is named for — the shell's own chrome
     * picks up Cinder component styles.
     */
  });

  test('narrow viewport: the sidebar is an off-canvas drawer with working open/close/scrim/inert', async ({
    page,
  }) => {
    // Phone-width viewport so the @media (max-width: 720px) drawer rules engage.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForSelector('#sidebar-drawer', { state: 'attached' });

    const toggle = page.getByRole('button', { name: 'Toggle component list' });
    const drawer = page.locator('#sidebar-drawer');
    const main = page.locator('main');

    // Closed: the hamburger is visible, the drawer is hidden from the a11y tree
    // and Tab order via visibility:hidden, and main is reachable (not inert).
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toHaveCSS('visibility', 'hidden');
    await expect(main).not.toHaveAttribute('inert', /.*/);

    // Open: the drawer slides in (visibility:visible), the scrim appears, the
    // toggle reports expanded, and the content behind the scrim goes inert so
    // keyboard users can't tab behind it.
    await toggle.click();
    await expect(drawer).toHaveCSS('visibility', 'visible');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.sidebar-backdrop')).toBeVisible();
    await expect(main).toHaveAttribute('inert', /.*/);

    // Close via the in-drawer ✕ button: drawer hides again, scrim is gone, inert
    // is cleared.
    await page.getByRole('button', { name: 'Close component list' }).click();
    await expect(drawer).toHaveCSS('visibility', 'hidden');
    await expect(page.locator('.sidebar-backdrop')).toHaveCount(0);
    await expect(main).not.toHaveAttribute('inert', /.*/);

    // Reopen, then dismiss by clicking the backdrop scrim. The drawer (≤280px)
    // covers the inline-start edge, so click the uncovered right side of the
    // 375px-wide viewport — clicking over the drawer would hit the drawer, not
    // the scrim.
    await toggle.click();
    await expect(drawer).toHaveCSS('visibility', 'visible');
    await page.locator('.sidebar-backdrop').click({ position: { x: 350, y: 400 } });
    await expect(drawer).toHaveCSS('visibility', 'hidden');

    // Reopen, then dismiss with Escape.
    await toggle.click();
    await expect(drawer).toHaveCSS('visibility', 'visible');
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCSS('visibility', 'hidden');

    // Growing back to a wide viewport drops the drawer state entirely: the
    // sidebar is the static column again (toggle hidden, main never inert).
    await toggle.click();
    await expect(drawer).toHaveCSS('visibility', 'visible');
    await page.setViewportSize({ width: 1280, height: 800 });
    // Query by class, not role: at wide width the toggle is display:none and
    // therefore absent from the accessibility tree, so getByRole can't see it.
    await expect(page.locator('.sidebar-toggle')).toHaveCSS('display', 'none');
    await expect(main).not.toHaveAttribute('inert', /.*/);
    // The drawer is now the static in-flow sidebar (visible, no off-canvas
    // transform), confirming the open state was dropped on widen.
    await expect(drawer).toHaveCSS('visibility', 'visible');
  });
});
