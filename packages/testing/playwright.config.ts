import { defineConfig, devices } from '@playwright/test';
import { PLAYGROUND_URL } from './src/helpers/playground-url.ts';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/playwright',
  fullyParallel: true,
  ...(process.env['CI'] ? { workers: 2 } : {}),
  reporter: [
    ['html', { outputFolder: './playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: './test-results/results.json' }],
  ],
  use: {
    baseURL: PLAYGROUND_URL,
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Intentionally no `webServer` block. `scripts/start-server.ts` owns the
  // dev-server lifecycle so that manifest preparation (which must run before
  // Playwright resolves test names) and server startup share a single owner.
  // Splitting them across Playwright's webServer + a pretest script
  // re-introduces a sequencing race; keep them together.
});
