import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/playground-production.playwright.ts',
  outputDir: './test-results/playground-production',
  fullyParallel: true,
  retries: 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [['list'], ['json', { outputFile: './test-results/playground-production.json' }]],
  use: {
    baseURL: process.env['PLAYGROUND_STATIC_BASE_URL'] ?? 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
