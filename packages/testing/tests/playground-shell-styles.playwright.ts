import { expect, test, type Locator, type Page } from '@playwright/test';

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
/*
 * The landing page now renders the SAME chrome as every documentation page —
 * one `nav.dx-nav` with a filter input, one top bar, one theme control. It used
 * to be a separate shell built from Cinder's SideNavigation and Input, with its
 * own theme segmented control and its own label casing.
 */
async function waitForShellLayout(page: Page): Promise<void> {
  await page.waitForSelector('#sidebar-filter', { state: 'visible' });
  await page.waitForSelector('.dx-nav__list', { state: 'visible' });
  await page.waitForFunction(() => {
    const navList = document.querySelector('.dx-nav__list');
    const filter = document.querySelector('#sidebar-filter');
    return [navList, filter].every(
      (element) => element instanceof HTMLElement && element.getBoundingClientRect().height > 0,
    );
  });
}

test.describe('playground shell styles', () => {
  test('outer shell chrome loads Cinder component styles', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForShellLayout(page);

    const sidebarList = page.locator('.dx-nav__list');
    const filterInput = page.locator('#sidebar-filter');

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
    await expect(page.locator('.dx-content--landing .readme-content')).toBeVisible();
    /*
     * The iframe preview and the viewport/custom-width controls are gone: the
     * shell no longer renders component documentation, and the documentation
     * page mounts its preview inline with its own width control. What this test
     * still guarantees is the thing it is named for — the shell's own chrome
     * picks up Cinder component styles.
     */
  });

  test('narrow viewport: the component nav stacks above the content', async ({ page }) => {
    /*
     * The nav is no longer an off-canvas drawer. The landing page and the
     * documentation pages share one chrome, and below the 720px breakpoint that
     * chrome turns the fixed column into a bounded, scrollable block above the
     * content — so the page scrolls as one document rather than trapping focus
     * behind a scrim.
     */
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'load' });
    await waitForShellLayout(page);

    const nav = page.locator('nav.dx-nav');
    await expect(nav).toBeVisible();

    const metrics = await nav.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        position: style.position,
        maxHeight: Number.parseFloat(style.maxHeight),
        viewportHeight: window.innerHeight,
      };
    });

    // Static (not fixed) so it participates in normal document flow, and bounded
    // so it cannot push the documentation entirely below the fold.
    expect(metrics.position).toBe('static');
    expect(metrics.maxHeight).toBeLessThan(metrics.viewportHeight);

    // The filter still works at this width.
    await page.locator('#sidebar-filter').fill('badge');
    await expect(page.locator('.dx-nav__link')).toHaveCount(1);
  });
});
