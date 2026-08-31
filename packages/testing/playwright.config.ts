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
  // CI already runs eight shards concurrently. Keep one browser worker per
  // shard so the long-lived, compiler-backed playground server and Chromium
  // do not overcommit the runner: under two workers the server can disappear
  // mid-shard after the first resource-sensitive test, turning every remaining
  // test into a connection refusal. Local development stays parallel.
  ...(process.env['CI'] ? { workers: 1 } : {}),
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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // The reduced-motion exit-transition and cascade-precedence tests only
      // belong to the `chromium-reduced-motion` project below.
      testIgnore: [
        '**/overlay-reduced-motion-exit.playwright.ts',
        '**/reduced-motion-cascade-precedence.playwright.ts',
      ],
    },
    // CIN-376: emulates `prefers-reduced-motion: reduce` at the browser-context
    // level (not per-test `themeContextOptions`/`contextOptions` overrides) so
    // exit-transition tests can assert every anchored overlay's
    // `AnchoredOverlayExitState`/`waitForTransitionCompletion` teardown still
    // unmounts immediately under reduced motion, not just under the default
    // no-preference project. CIN-468's cascade-precedence test needs the same
    // context-level emulation to prove which reduced-motion CSS block a real
    // browser applies. Scoped to just these two test files via `testMatch` so
    // it doesn't re-run the entire suite a second time.
    {
      name: 'chromium-reduced-motion',
      testMatch: [
        '**/overlay-reduced-motion-exit.playwright.ts',
        '**/reduced-motion-cascade-precedence.playwright.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],
  // Intentionally no `webServer` block. `scripts/start-server.ts` owns the
  // dev-server lifecycle so that manifest preparation (which must run before
  // Playwright resolves test names) and server startup share a single owner.
  // Splitting them across Playwright's webServer + a pretest script
  // re-introduces a sequencing race; keep them together.
});
