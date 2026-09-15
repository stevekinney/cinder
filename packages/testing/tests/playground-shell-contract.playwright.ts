import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const pages = [
  { name: 'home', route: '/' },
  { name: 'action-row', route: '/page/action-row' },
] as const;

const namedPages = [
  '/page/button',
  '/page/chat',
  '/page/side-navigation',
  '/page/sidebar',
] as const;

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of viewports) {
    test(`unframed shell is stable at ${viewport.name} in ${theme}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      let homeGutters: { left: number; right: number } | undefined;
      for (const target of pages) {
        await page.goto(`${target.route}?theme=${theme}`, { waitUntil: 'load' });
        await expect(page.locator('.dx-shell').first()).toBeVisible();

        const metrics = await page.evaluate(() => {
          const root = document.querySelector<HTMLElement>('.dx-shell');
          const body = document.body;
          if (root === null) throw new Error('missing .dx-shell root');
          const rootStyles = getComputedStyle(root);
          const bodyStyles = getComputedStyle(body);
          const importElement = document.querySelector('.dx-import');
          const content = document.querySelector<HTMLElement>('.dx__inner');
          if (content === null) throw new Error('missing .dx__inner content boundary');
          const contentRect = content.getBoundingClientRect();
          return {
            rootBorder: rootStyles.borderWidth,
            bodyPadding: bodyStyles.padding,
            pageOverflow: [document.documentElement, body, root].map(
              (element) => getComputedStyle(element).overflowX,
            ),
            scrollWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            importBorder:
              importElement === null ? null : getComputedStyle(importElement).borderWidth,
            contentLeft: contentRect.left,
            contentRight: window.innerWidth - contentRect.right,
            overflowingElements: Array.from(document.querySelectorAll<HTMLElement>('*'))
              .map((element) => {
                let owner: Element | undefined;
                for (
                  let candidate: Element | null = element;
                  candidate !== null;
                  candidate = candidate.parentElement
                ) {
                  const overflow = getComputedStyle(candidate).overflowX;
                  if (overflow === 'auto' || overflow === 'scroll' || overflow === 'clip') {
                    owner = candidate;
                    break;
                  }
                }
                const rect = element.getBoundingClientRect();
                return {
                  element: `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).replaceAll(' ', '.')}` : ''}`,
                  right: rect.right,
                  left: rect.left,
                  hasOverflowOwner: owner !== undefined,
                };
              })
              .filter(
                ({ right, left, hasOverflowOwner }) =>
                  !hasOverflowOwner && (right > window.innerWidth + 0.5 || left < -0.5),
              ),
          };
        });

        expect(metrics.rootBorder).toBe('0px');
        expect(metrics.bodyPadding).toBe('0px');
        expect(metrics.pageOverflow).not.toContain('clip');
        expect(metrics.pageOverflow).not.toContain('hidden');
        expect(
          metrics.scrollWidth,
          `${target.name} metrics: ${JSON.stringify(metrics)}`,
        ).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(metrics.overflowingElements, `${target.name} overflowing elements`).toEqual([]);
        if (target.name === 'home') {
          homeGutters = { left: metrics.contentLeft, right: metrics.contentRight };
        } else {
          expect(homeGutters, 'home gutter measurements must be captured first').toBeDefined();
          expect(metrics.contentLeft, `${target.name} left gutter`).toBe(homeGutters?.left);
          expect(metrics.contentRight, `${target.name} right gutter`).toBe(homeGutters?.right);
        }
        if (target.name === 'action-row') {
          expect(metrics.importBorder).toBe('1px');
          await expect(page.locator('[aria-label="Component facts"]')).toHaveCount(0);
        }
      }
    });
  }
}

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of viewports) {
    test(`named pages stay within the shell at ${viewport.name} in ${theme}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const route of namedPages) {
        await page.goto(`${route}?theme=${theme}`, { waitUntil: 'load' });
        await expect(page.locator('.dx-shell').first()).toBeVisible();
        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        expect(metrics.scrollWidth, route).toBeLessThanOrEqual(metrics.viewportWidth);
      }
    });
  }
}

test('snapshot and preview surfaces preserve their existing gutters', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const surface of ['snapshot', 'preview']) {
      await page.goto(`/page/button?${surface}=1`, { waitUntil: 'load' });
      await expect(page.locator('#app > *').first()).toBeVisible();
      await expect(page.locator('body')).toHaveCSS(
        'padding',
        viewport.name === 'desktop' ? '24px' : '9.75px',
      );
    }
  }
});

test('captures the approved home and Action Row shell matrix', async ({ page }, testInfo) => {
  const outputDirectory =
    process.env['CINDER_SHELL_CAPTURE_DIR'] ?? testInfo.outputPath('shell-captures');
  await mkdir(outputDirectory, { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const target of pages) {
        await page.goto(`${target.route}?theme=${theme}`, { waitUntil: 'load' });
        await expect(page.locator('.dx-shell').first()).toBeVisible();
        await page.screenshot({
          path: `${outputDirectory}/${target.name}-${viewport.name}-${theme}.png`,
          fullPage: true,
        });
      }
    }
  }
});
