import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import PlaywrightAxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

type Report = { routes: string[] };
const reportPath = process.env['PLAYGROUND_STATIC_REPORT'];
if (!reportPath) throw new Error('PLAYGROUND_STATIC_REPORT is required');
const report = JSON.parse(readFileSync(resolve(reportPath), 'utf8')) as Report;
const routes = report.routes.filter((route) => route !== '/');
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

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
        await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText(
          'Documentation',
        );
        await expect(page.getByRole('tab', { name: 'Playground' })).toHaveAttribute(
          'aria-selected',
          'false',
        );
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
        await page.getByRole('tab', { name: 'Playground' }).click();
        await expect(page.getByRole('tab', { name: 'Playground' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await expect(page).toHaveURL(
          new RegExp(`${route.replaceAll('/', '\\/')}\\?view=playground$`),
        );
        await expect(page.locator('#view-panel-playground')).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Documentation' })).toHaveAttribute(
          'aria-selected',
          'false',
        );
        await expect(page.locator('#view-panel-documentation')).toBeHidden();
        await expect(page.locator('.dx-stage__canvas').first()).toBeVisible();
        const preview = page.locator('.dx-stage__canvas').first();
        await expect(
          preview.locator(
            '.example-preview[data-live-preview-ready], .example-preview[data-example-preview-ready]',
          ),
        ).toHaveCount(1);
        await expect(preview).not.toContainText('failed to render');
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
        await page.getByRole('tab', { name: 'Documentation' }).click();
        await expect(page.getByRole('tab', { name: 'Documentation' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`));
        await expect(page.locator('#view-panel-documentation')).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Playground' })).toHaveAttribute(
          'aria-selected',
          'false',
        );
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
