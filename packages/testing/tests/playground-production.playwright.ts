import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import PlaywrightAxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';

type Report = { routes: string[] };
const reportPath = process.env['PLAYGROUND_STATIC_REPORT'];
if (!reportPath) throw new Error('PLAYGROUND_STATIC_REPORT is required');
const report = JSON.parse(readFileSync(resolve(reportPath), 'utf8')) as Report;
const routes = report.routes;
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function exerciseSchemaValidation(route: string, preview: Locator): Promise<void> {
  if (route === '/page/json-schema-editor') {
    const editor = preview.getByRole('region', { name: 'JSON Schema editor', exact: true });
    await expect(editor.getByText('Valid (2020-12)', { exact: true })).toBeVisible();
    await editor.getByRole('tab', { name: 'JSON', exact: true }).click();
    await editor.getByRole('button', { name: 'Edit JSON', exact: true }).click();
    const input = editor.getByRole('textbox', { name: 'JSON', exact: true });
    const validSchema = await input.inputValue();
    await input.fill(JSON.stringify({ type: 42 }));
    await expect(editor.locator('.cinder-jse-json-view__errors')).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
    await input.fill(validSchema);
    await expect(editor.locator('.cinder-jse-json-view__errors')).toHaveCount(0);
    await expect(editor.getByText('Compile warning', { exact: true })).toHaveCount(0);
  } else if (route === '/page/schema-form') {
    const name = preview.getByRole('textbox', { name: 'Name', exact: true });
    const submit = preview.getByRole('button', { name: 'Save schedule', exact: true });
    const submission = preview.locator('section').filter({ hasText: 'Last valid submission' });
    await name.fill('');
    await submit.click();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(submission).toContainText('No payload submitted yet.');
    await name.fill('CSP verified schedule');
    await submit.click();
    await expect(submission).toContainText('CSP verified schedule');
    await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  }
}

async function exerciseLanding(
  page: import('@playwright/test').Page,
  diagnostics: string[],
): Promise<void> {
  await expect(page.locator('#landing-title')).toHaveText('cinder');
  const navigation = page.getByRole('navigation', { name: 'Components', exact: true });
  await expect(navigation).toBeVisible();

  const filter = page.getByRole('searchbox', { name: 'Filter components', exact: true });
  await filter.fill('Button');
  await expect(navigation.getByRole('link', { name: 'Button', exact: true })).toBeVisible();
  await filter.fill('');

  expect(diagnostics, 'landing page browser diagnostics').toEqual([]);

  const themeToggle = page.getByRole('button', { name: /Preview theme: switch to/ });
  const before = await page.locator('html').getAttribute('data-theme');
  await themeToggle.click();
  const after = await page.locator('html').getAttribute('data-theme');
  expect(after, 'landing theme toggle should update the explicit theme signal').not.toBe(before);
  // Theme changes hydrate the deferred shell and load its split chunks after
  // the landing page's initial network-idle boundary. Let that owned work
  // settle before navigating away so a real lazy chunk is not aborted by the
  // test's next action.
  await page.waitForLoadState('networkidle');

  const scrollRegions = page.locator('.readme-table-scroll');
  const overflowingIndex = await scrollRegions.evaluateAll((elements) =>
    elements.findIndex((element) => element.scrollWidth > element.clientWidth),
  );
  if (overflowingIndex >= 0) {
    const overflowingRegion = scrollRegions.nth(overflowingIndex);
    await overflowingRegion.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(overflowingRegion).not.toBeFocused();
    await page.keyboard.press('Tab');
    await expect(overflowingRegion).toBeFocused();
    await expect
      .poll(() => overflowingRegion.evaluate((element) => document.activeElement === element))
      .toBe(true);
    const beforeScroll = await overflowingRegion.evaluate((element) => element.scrollLeft);
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => overflowingRegion.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(beforeScroll);
  }
}

async function exerciseLandingNavigation(
  page: import('@playwright/test').Page,
  diagnostics: string[],
): Promise<void> {
  const browse = page.getByRole('link', { name: 'Browse components', exact: true });
  await expect(browse).toHaveAttribute('href', /\/page\//);
  await browse.click();
  await expect(page).toHaveURL(/\/page\//);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1')).toHaveCount(1);
  expect(diagnostics, 'component navigation browser diagnostics').toEqual([]);
}

for (const route of routes) {
  for (const viewport of viewports) {
    test(`${route} documentation and playground at ${viewport.name}`, async ({
      page,
    }, testInfo) => {
      const diagnostics: string[] = [];
      page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning')
          diagnostics.push(`console ${message.type()}: ${message.text()}`);
      });
      page.on('requestfailed', (request) => {
        diagnostics.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`);
      });
      page.on('response', (response) => {
        if (response.status() >= 400)
          diagnostics.push(`response ${response.status()}: ${response.url()}`);
      });
      try {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(route, { waitUntil: 'networkidle' });
        expect(response?.status(), `${route} documentation HTTP status`).toBe(200);
        if (route === '/') {
          await exerciseLanding(page, diagnostics);
          if (viewport.name === 'mobile') {
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth),
            ).toBeLessThanOrEqual(viewport.width);
          }
          const accessibility = await new PlaywrightAxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
          expect(
            accessibility.violations,
            `${route} ${viewport.name} accessibility violations`,
          ).toHaveLength(0);
          expect(diagnostics, `${route} ${viewport.name} browser diagnostics`).toEqual([]);
          await exerciseLandingNavigation(page, diagnostics);
          return;
        }
        const viewTabs = page.getByRole('tablist', { name: 'Component views', exact: true });
        const playgroundPanel = page.locator('#view-panel-playground');
        await expect(viewTabs.locator('[role="tab"][aria-selected="true"]')).toHaveText(
          'Documentation',
        );
        await expect(
          viewTabs.getByRole('tab', { name: 'Playground', exact: true }),
        ).toHaveAttribute('aria-selected', 'false');
        await expect(page.locator('#view-panel-documentation')).toBeVisible();
        await expect(page.locator('#view-panel-playground')).toBeHidden();
        await expect(page.locator('h1')).toHaveCount(1);
        const documentationAccessibility = await new PlaywrightAxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          documentationAccessibility.violations,
          `${route} ${viewport.name} documentation accessibility violations`,
        ).toHaveLength(0);
        if (viewport.name === 'mobile') {
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(viewport.width);
        }
        await viewTabs.getByRole('tab', { name: 'Playground', exact: true }).click();
        await expect(
          viewTabs.getByRole('tab', { name: 'Playground', exact: true }),
        ).toHaveAttribute('aria-selected', 'true');
        await expect(page).toHaveURL(
          new RegExp(`${route.replaceAll('/', '\\/')}\\?view=playground$`),
        );
        await expect(page.locator('#view-panel-playground')).toBeVisible();
        await expect(
          viewTabs.getByRole('tab', { name: 'Documentation', exact: true }),
        ).toHaveAttribute('aria-selected', 'false');
        await expect(page.locator('#view-panel-documentation')).toBeHidden();
        await expect(playgroundPanel.locator('.dx-stage__canvas').first()).toBeVisible();
        const preview = playgroundPanel.locator('.dx-stage__canvas').first();
        await expect(
          preview.locator(
            ':scope > .example-preview[data-live-preview-ready], :scope > .example-preview[data-example-preview-ready]',
          ),
        ).toHaveCount(1);
        await expect(preview).not.toContainText('failed to render');
        await exerciseSchemaValidation(route, preview);
        if (viewport.name === 'mobile') {
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(viewport.width);
        }
        const accessibility = await new PlaywrightAxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          accessibility.violations,
          `${route} ${viewport.name} accessibility violations`,
        ).toHaveLength(0);
        await viewTabs.getByRole('tab', { name: 'Documentation', exact: true }).click();
        await expect(
          viewTabs.getByRole('tab', { name: 'Documentation', exact: true }),
        ).toHaveAttribute('aria-selected', 'true');
        await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`));
        await expect(page.locator('#view-panel-documentation')).toBeVisible();
        await expect(
          viewTabs.getByRole('tab', { name: 'Playground', exact: true }),
        ).toHaveAttribute('aria-selected', 'false');
        await expect(page.locator('#view-panel-playground')).toBeHidden();
        expect(diagnostics, `${route} ${viewport.name} browser diagnostics`).toEqual([]);
      } finally {
        await testInfo.attach('browser-diagnostics', {
          body: JSON.stringify({ route, viewport: viewport.name, diagnostics }, null, 2),
          contentType: 'application/json',
        });
      }
    });
  }
}
