import { defineConfig, devices } from '@playwright/test';
import { PLAYGROUND_URL } from './src/helpers/playground-url.ts';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/playwright',
  fullyParallel: true,
  // Heavy editor components (Chat, MarkdownEditor, ReviewEditor — all
  // Milkdown-backed) can take 30-40s to mount on the GitHub Actions runner.
  // The fixture caps its `#app > *` wait at 50s; this test-level timeout
  // leaves ~30s of headroom for runAxe + captureScreenshot on the slow path.
  timeout: 90_000,
  // CI uses 2 workers (the chunk-[hash].js fix in #39 resolved the
  // "Multiple files share the same output path" race that previously forced
  // workers=1). Local stays parallel (default = cores). Override via
  // PLAYWRIGHT_WORKERS for one-off experiments.
  ...(process.env['PLAYWRIGHT_WORKERS']
    ? { workers: Number(process.env['PLAYWRIGHT_WORKERS']) }
    : process.env['CI']
      ? { workers: 2 }
      : {}),
  reporter: [
    ['html', { outputFolder: './playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: './test-results/results.json' }],
  ],
  use: {
    baseURL: PLAYGROUND_URL,
    // Trace recording adds measurable per-test overhead. CI enables it only
    // for the full main-branch run (PLAYWRIGHT_TRACE=retain-on-failure) so
    // regression debugging keeps its traces; changed-component PR runs
    // default to 'off' for speed.
    trace:
      (process.env['PLAYWRIGHT_TRACE'] as 'on' | 'off' | 'retain-on-failure' | undefined) ??
      (process.env['CI'] ? 'off' : 'retain-on-failure'),
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
