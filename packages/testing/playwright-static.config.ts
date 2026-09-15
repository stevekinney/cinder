import { defineConfig, devices } from '@playwright/test';
import { basename, dirname } from 'node:path';

const blobPath = process.env['PLAYWRIGHT_BLOB_OUTPUT_FILE'];

export default defineConfig({
  testDir: process.env['PLAYWRIGHT_TEST_DIR'] ?? './tests',
  testMatch: process.env['PLAYWRIGHT_TEST_MATCH'] ?? '**/playground-production.playwright.ts',
  outputDir: process.env['PLAYWRIGHT_TEST_OUTPUT_DIR'] ?? './test-results/playground-production',
  fullyParallel: true,
  retries: 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env['PLAYWRIGHT_JSON_OUTPUT_FILE'] ?? './test-results/playground-production.json',
      },
    ],
    ...(blobPath
      ? [['blob', { outputDir: dirname(blobPath), fileName: basename(blobPath) }] as const]
      : []),
  ],
  use: {
    baseURL: process.env['PLAYGROUND_STATIC_BASE_URL'] ?? 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
