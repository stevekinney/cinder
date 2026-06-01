import {
  expect,
  test,
  type FullConfig,
  type Locator,
  type Page,
  type PageAssertionsToHaveScreenshotOptions,
} from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { MaskRule } from '../../../components/scripts/lib/visual-fixtures/schema.ts';
import { screenshotPath, snapshotPath, type ArtifactKey } from './artifact-path.ts';

// ---------------------------------------------------------------------------
// Visual diff mode
// ---------------------------------------------------------------------------

/** The three operating modes for snapshot diffing. */
export type VisualDiffMode = 'off' | 'report' | 'block';

const VALID_MODES: ReadonlySet<VisualDiffMode> = new Set<VisualDiffMode>([
  'off',
  'report',
  'block',
]);

/** Type guard narrowing an arbitrary string to a {@link VisualDiffMode}. */
function isVisualDiffMode(value: string): value is VisualDiffMode {
  return (VALID_MODES as ReadonlySet<string>).has(value);
}

/**
 * Reads `CINDER_VISUAL_DIFF` from the environment and returns the resolved mode.
 * Invalid or unset values fall back to `'off'` with a one-time console warning.
 */
export function resolveVisualDiffMode(): VisualDiffMode {
  const raw = process.env['CINDER_VISUAL_DIFF'];

  if (raw === undefined || raw === '') {
    return 'off';
  }

  if (isVisualDiffMode(raw)) {
    return raw;
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

/**
 * The pixel-comparison tolerance block mode (and report mode) hand to
 * Playwright's `toHaveScreenshot`. Exported so the block-mode comparison
 * contract test consumes the exact same `threshold`/`maxDiffPixels` the gate
 * uses, instead of duplicating literals that could silently drift. Mirrored in
 * `playwright.config.ts`.
 */
export const SNAPSHOT_DIFF_OPTIONS: ToHaveScreenshotOptions = {
  maxDiffPixels: 2,
  threshold: 0.1,
  animations: 'disabled',
  caret: 'hide',
};

// ---------------------------------------------------------------------------
// Block-mode missing-baseline guard
// ---------------------------------------------------------------------------

/**
 * Playwright's `config.updateSnapshots` value, narrowed to what block mode
 * cares about. `'none'` means we are validating against committed baselines
 * (the CI block-mode run); any other value (`'all'`, `'missing'`, `'changed'`)
 * means `--update-snapshots` is active, so a missing baseline is expected and
 * must NOT error — `toHaveScreenshot` legitimately writes the new baseline.
 *
 * Aliased from Playwright's own `FullConfig['updateSnapshots']` (the type of
 * `test.info().config.updateSnapshots`) so the `'none'` sentinel below stays
 * pinned to the installed Playwright union and breaks the build if that union
 * ever changes, rather than silently accepting any string.
 */
export type UpdateSnapshotsState = FullConfig['updateSnapshots'];

/**
 * The result of {@link blockBaselineGuard}. When `ok` is `false`, `message`
 * carries an actionable instruction the caller should `throw` to fail the
 * Playwright test with project-specific guidance rather than Playwright's
 * generic "A snapshot doesn't exist" wording.
 */
export type BlockBaselineGuardResult = { ok: true } | { ok: false; message: string };

/**
 * Whether Playwright is in a baseline-authoring state (`--update-snapshots`),
 * in which a missing baseline is expected and must NOT trigger the guard.
 *
 * Written as an exhaustive switch over every {@link UpdateSnapshotsState}
 * literal rather than `!== 'none'`: the `never`-typed default makes any literal
 * Playwright adds to its `updateSnapshots` union a compile-time error here,
 * forcing a deliberate validate-vs-author decision instead of silently treating
 * the new mode as authoring and suppressing the missing-baseline guard.
 */
function isAuthoringState(updateSnapshots: UpdateSnapshotsState): boolean {
  switch (updateSnapshots) {
    case 'none':
      // Validating against committed baselines — the guard may fire.
      return false;
    case 'all':
    case 'changed':
    case 'missing':
      // --update-snapshots is active; toHaveScreenshot legitimately writes the
      // baseline, so a missing one is not an error.
      return true;
    default: {
      const exhaustive: never = updateSnapshots;
      return exhaustive;
    }
  }
}

/**
 * Decides whether a block-mode capture should fail fast with an actionable
 * "update baselines" message instead of delegating to `toHaveScreenshot`.
 *
 * In block mode a missing baseline is a hard error: there is no committed
 * golden image to compare against, so the only safe outcomes are (a) the
 * developer authors a baseline via the documented Docker workflow, or (b) the
 * run is explicitly an update run. Playwright's default missing-snapshot
 * message reports that a snapshot is absent but not how this repo expects you
 * to produce one, so we substitute a message that names the update command.
 *
 * Stays silent (returns `{ ok: true }`) when the baseline exists, or when
 * Playwright is in an update state.
 *
 * @param baselinePath - Absolute path to the expected committed baseline PNG.
 * @param baselineExists - Whether that file is present on disk.
 * @param updateSnapshots - Playwright's `config.updateSnapshots` value.
 */
export function blockBaselineGuard(
  baselinePath: string,
  baselineExists: boolean,
  updateSnapshots: UpdateSnapshotsState,
): BlockBaselineGuardResult {
  if (baselineExists || isAuthoringState(updateSnapshots)) {
    return { ok: true };
  }

  const message = [
    'Visual-regression baseline missing (CINDER_VISUAL_DIFF=block):',
    `  ${baselinePath}`,
    '',
    'Block mode compares against committed baselines, but none exists for this case.',
    'Baselines are authored only inside the canonical cinder-playwright Docker image',
    '(macOS / Linux dev-host pixels diverge from CI and would be flaky), so run:',
    '',
    '  bun run --filter=@cinder/testing test:browser:update:docker',
    '',
    'or trigger the "update-baselines" workflow_dispatch on the browser-tests workflow.',
    'See docs/visual-regression/baselines.md for the full update workflow.',
  ].join('\n');

  return { ok: false, message };
}

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
  // page.getByTestId() is safe against CSS selector injection — never interpolate
  // testId values directly into a CSS selector string.
  return masks.map((rule) => page.getByTestId(rule.testId));
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
  // Fail fast with an actionable message when the committed baseline is absent
  // and we are validating (not authoring). Playwright's default missing-snapshot
  // error does not point at this repo's Docker-only update workflow.
  const baseline = snapshotPath(key);
  const guard = blockBaselineGuard(
    baseline,
    existsSync(baseline),
    test.info().config.updateSnapshots,
  );
  if (!guard.ok) {
    throw new Error(guard.message);
  }

  // Pass [slug, filename] so Playwright nests under `snapshots/<slug>/` via
  // snapshotPathTemplate. Using only basename would collapse all components
  // into a flat directory and cause cross-component name collisions.
  const name: [string, string] = [key.slug, `${key.theme}-${key.viewport}-${key.fixture}.png`];
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
    const name: [string, string] = [key.slug, `${key.theme}-${key.viewport}-${key.fixture}.png`];
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
