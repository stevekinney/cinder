import { defineConfig, devices } from '@playwright/test';
import { PLAYGROUND_URL } from './src/helpers/playground-url.ts';

const TRACE_VALUES = ['on', 'off', 'retain-on-failure', 'on-first-retry'] as const;
type TraceValue = (typeof TRACE_VALUES)[number];

function resolveTrace(): TraceValue {
  const raw = process.env['PLAYWRIGHT_TRACE'];
  if (raw !== undefined && (TRACE_VALUES as readonly string[]).includes(raw)) {
    return raw as TraceValue;
  }
  // No override: CI defaults to off (trace recording adds measurable
  // per-test overhead, and the CI workflow opts into 'retain-on-failure'
  // for the full main-branch run via PLAYWRIGHT_TRACE). Local development
  // keeps traces on for debugging.
  return process.env['CI'] ? 'off' : 'retain-on-failure';
}

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/playwright',
  fullyParallel: true,
  // Heavy editor components (Chat, MarkdownEditor, ReviewEditor — all
  // Milkdown-backed) used to take 30-40s to mount on the GitHub Actions
  // runner. Post-#39 they mount in single-digit seconds; the per-test 90s
  // timeout leaves generous headroom for runAxe + captureScreenshot.
  timeout: 90_000,
  // CI uses 2 workers (the chunk-[hash].js fix in #39 resolved the
  // "Multiple files share the same output path" race that previously forced
  // workers=1). Local stays parallel (default = cores).
  ...(process.env['CI'] ? { workers: 2 } : {}),
  reporter: [
    ['html', { outputFolder: './playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: './test-results/results.json' }],
  ],
  use: {
    baseURL: PLAYGROUND_URL,
    trace: resolveTrace(),
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
