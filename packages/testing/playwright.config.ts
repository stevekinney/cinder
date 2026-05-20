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
  // per-test overhead). The CI workflow opts into 'retain-on-failure'
  // via PLAYWRIGHT_TRACE for any full-matrix run — pushes to main and
  // PRs that touched shared utilities. Local development keeps traces
  // on for debugging.
  return process.env['CI'] ? 'off' : 'retain-on-failure';
}

export default defineConfig({
  testDir: './tests',
  /*
   * Use a `.playwright.ts` suffix so Bun's test runner (which picks up
   * `*.test.ts` and `*.spec.ts` by default at the workspace root) does not
   * try to load these files. Playwright is the only runner that exercises
   * this directory.
   */
  testMatch: '**/*.playwright.ts',
  outputDir: './test-results/playwright',
  fullyParallel: true,
  // Heavy editor components (Chat, MarkdownEditor, ReviewEditor — all
  // Milkdown-backed) used to take 30-40s to mount on the GitHub Actions
  // runner. Post-#39 they mount in single-digit seconds; the per-test 90s
  // timeout leaves generous headroom for runAxe + captureScreenshot.
  timeout: 90_000,
  // In block mode, retries would create spurious baseline-update prompts;
  // disable them so failures surface cleanly and immediately.
  ...(process.env['CINDER_VISUAL_DIFF'] === 'block' ? { retries: 0 } : {}),
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
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 2,
      threshold: 0.1,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  // Snapshots are written to packages/testing/snapshots/<slug>/<theme>-<viewport>-<fixture>.png.
  // The basename passed to toHaveScreenshot() carries the full slug/theme/viewport/fixture
  // pattern; Playwright resolves the directory from this template.
  snapshotPathTemplate: '{testDir}/../snapshots/{arg}{ext}',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Intentionally no `webServer` block. `scripts/start-server.ts` owns the
  // dev-server lifecycle so that manifest preparation (which must run before
  // Playwright resolves test names) and server startup share a single owner.
  // Splitting them across Playwright's webServer + a pretest script
  // re-introduces a sequencing race; keep them together.
});
