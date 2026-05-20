import {
  expect,
  test,
  type Locator,
  type Page,
  type PageAssertionsToHaveScreenshotOptions,
} from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { screenshotPath, snapshotPath, type ArtifactKey } from './artifact-path.ts';
import type { MaskRule } from './fixture-schema.ts';

// ---------------------------------------------------------------------------
// Visual diff mode
// ---------------------------------------------------------------------------

/** The three operating modes for snapshot diffing. */
export type VisualDiffMode = 'off' | 'report' | 'block';

const VALID_MODES = new Set<string>(['off', 'report', 'block']);

/**
 * Reads `CINDER_VISUAL_DIFF` from the environment and returns the resolved mode.
 * Invalid or unset values fall back to `'off'` with a one-time console warning.
 */
export function resolveVisualDiffMode(): VisualDiffMode {
  const raw = process.env['CINDER_VISUAL_DIFF'];

  if (raw === undefined || raw === '') {
    return 'off';
  }

  if (VALID_MODES.has(raw)) {
    return raw as VisualDiffMode;
  }

  console.warn(
    `[cinder/testing] CINDER_VISUAL_DIFF="${raw}" is not a valid mode (off | report | block). Falling back to 'off'.`,
  );
  return 'off';
}

// ---------------------------------------------------------------------------
// Screenshot capture options
// ---------------------------------------------------------------------------

/** Options for {@link captureScreenshot}. */
export type CaptureScreenshotOptions = {
  /** Mask rules from the fixture file. Elements matching these testIds are hidden during pixel comparison. */
  masks?: MaskRule[];
};

// ---------------------------------------------------------------------------
// Animation suppression
// ---------------------------------------------------------------------------

const ANIMATION_KILL_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

// ---------------------------------------------------------------------------
// toHaveScreenshot options (shared between block and report modes)
// ---------------------------------------------------------------------------

/**
 * Options passed to Playwright's `toHaveScreenshot`. Uses the exported interface
 * directly from `@playwright/test` to stay in sync with the installed version.
 */
type ToHaveScreenshotOptions = PageAssertionsToHaveScreenshotOptions;

const SNAPSHOT_DIFF_OPTIONS: ToHaveScreenshotOptions = {
  maxDiffPixels: 2,
  threshold: 0.1,
  animations: 'disabled',
  caret: 'hide',
};

// ---------------------------------------------------------------------------
// Report-mode helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic worker-safe path for a report fragment.
 * Uses a sha256 of the testId so filenames stay filesystem-safe.
 */
function reportFragmentPath(testId: string): string {
  const hash = createHash('sha256').update(testId).digest('hex');
  const workerId = process.env['TEST_WORKER_INDEX'] ?? '0';
  return `test-results/visual-report/${workerId}/${hash}.json`;
}

type ReportFragment = {
  testId: string;
  slug: string;
  theme: string;
  viewport: string;
  fixture: string;
  diffPixels: number;
};

// ---------------------------------------------------------------------------
// Mask helper
// ---------------------------------------------------------------------------

/** Converts a list of MaskRule entries to Playwright Locators for the given page. */
function masksToLocators(page: Page, masks: MaskRule[]): Locator[] {
  return masks.map((rule) => page.locator(`[data-testid="${rule.testId}"]`));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Captures a screenshot of the current page state, choosing the appropriate
 * strategy based on the `CINDER_VISUAL_DIFF` environment variable.
 *
 * - `'off'` (default): writes a PNG to `screenshots/<slug>/` for manual review.
 *   No pixel comparison is performed.
 * - `'block'`: calls `expect(page).toHaveScreenshot(...)` against the committed
 *   baseline. The test fails immediately when pixels differ beyond tolerance.
 * - `'report'`: non-blocking comparison. When a baseline exists, the diff is
 *   measured and written as a JSON fragment plus an attached diff PNG. The test
 *   never throws in this mode.
 *
 * The ANIMATION_KILL_CSS preamble and `document.fonts.ready` wait are applied
 * in all modes to ensure deterministic rendering before capture.
 */
export async function captureScreenshot(
  page: Page,
  key: ArtifactKey,
  options?: CaptureScreenshotOptions,
): Promise<void> {
  await page.addStyleTag({ content: ANIMATION_KILL_CSS });
  // Use string form to avoid a TypeScript dom-lib dependency; runs in browser context.
  await page.evaluate('document.fonts.ready');
  // The fixture has already waited for `#app > *` before returning the page;
  // no re-wait needed here.

  const mode = resolveVisualDiffMode();

  if (mode === 'off') {
    await captureOffMode(page, key);
    return;
  }

  if (mode === 'block') {
    await captureBlockMode(page, key, options);
    return;
  }

  // mode === 'report'
  await captureReportMode(page, key, options);
}

// ---------------------------------------------------------------------------
// Mode implementations
// ---------------------------------------------------------------------------

async function captureOffMode(page: Page, key: ArtifactKey): Promise<void> {
  const path = screenshotPath(key);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({
    path,
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  });
}

async function captureBlockMode(
  page: Page,
  key: ArtifactKey,
  options: CaptureScreenshotOptions | undefined,
): Promise<void> {
  const name = basename(snapshotPath(key));
  const snapshotOptions: ToHaveScreenshotOptions = { ...SNAPSHOT_DIFF_OPTIONS };

  if (options?.masks !== undefined && options.masks.length > 0) {
    snapshotOptions.mask = masksToLocators(page, options.masks);
  }

  await expect(page).toHaveScreenshot(name, snapshotOptions);
}

async function captureReportMode(
  page: Page,
  key: ArtifactKey,
  options: CaptureScreenshotOptions | undefined,
): Promise<void> {
  const baseline = snapshotPath(key);

  // Skip silently when no baseline is committed yet; the baseline-coverage-check
  // script will surface missing baselines in its own CI job.
  if (!existsSync(baseline)) {
    return;
  }

  try {
    const name = basename(baseline);
    const snapshotOptions: ToHaveScreenshotOptions = { ...SNAPSHOT_DIFF_OPTIONS };

    if (options?.masks !== undefined && options.masks.length > 0) {
      snapshotOptions.mask = masksToLocators(page, options.masks);
    }

    await expect(page).toHaveScreenshot(name, snapshotOptions);
  } catch (error) {
    // Extract diffPixels from Playwright's error message when available.
    const message = error instanceof Error ? error.message : String(error);
    const diffMatch = /(\d+) pixels?/.exec(message);
    const pixelString = diffMatch?.[1];
    const diffPixels = pixelString !== undefined ? parseInt(pixelString, 10) : -1;

    const testInfo = test.info();
    const fragment: ReportFragment = {
      testId: testInfo.testId,
      slug: key.slug,
      theme: key.theme,
      viewport: key.viewport,
      fixture: key.fixture,
      diffPixels,
    };

    const fragmentPath = reportFragmentPath(testInfo.testId);
    await mkdir(dirname(fragmentPath), { recursive: true });
    await writeFile(fragmentPath, JSON.stringify(fragment, null, 2));

    // Attach the diff PNG if Playwright produced one.
    const attachments = testInfo.attachments;
    const diffAttachment = attachments.find((a) => a.name === 'diff' && a.path !== undefined);
    if (diffAttachment?.path !== undefined) {
      await testInfo.attach('visual-diff', {
        path: diffAttachment.path,
        contentType: 'image/png',
      });
    }
    // Never throw in report mode — the fragment records the mismatch.
  }
}
