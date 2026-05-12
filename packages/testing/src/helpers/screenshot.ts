import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page } from '@playwright/test';
import { screenshotPath, type ArtifactKey } from './artifact-path.ts';

const ANIMATION_KILL_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

export async function captureScreenshot(page: Page, key: ArtifactKey): Promise<void> {
  await page.addStyleTag({ content: ANIMATION_KILL_CSS });
  // Use string form to avoid a TypeScript dom-lib dependency; runs in browser context.
  await page.evaluate('document.fonts.ready');
  await page.waitForSelector('#app > *', { state: 'visible', timeout: 10_000 });

  const path = screenshotPath(key);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({
    path,
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  });
}
