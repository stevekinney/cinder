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
  // CI runs serially: the playground server's lazy `Bun.build` for page bundles
  // doesn't dedupe concurrent requests for the same component, so parallel
  // tests can race on the build's output path. One worker eliminates the race
  // and the slower runner has more headroom for heavy components. Local stays
  // parallel (default = cores).
  ...(process.env['CI'] ? { workers: 1 } : {}),
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
