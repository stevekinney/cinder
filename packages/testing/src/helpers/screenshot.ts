import {
  type FullConfig,
  type Locator,
  type Page,
  type PageAssertionsToHaveScreenshotOptions,
  type TestInfo,
} from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { environmentConfiguration } from '../environment-configuration.ts';
import type { MaskRule } from '../visual-fixtures.ts';
import { screenshotPath, type ArtifactKey } from './artifact-path.ts';
import { parseComponentFilter, parseComponentScopeValue } from './component-filter.ts';
import { loadManifest } from './manifest.ts';

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
  const raw = environmentConfiguration().cinderVisualDiff;

  if (raw === undefined || raw === '') {
    return 'off';
  }

  if (isVisualDiffMode(raw)) {
    return raw;
  }

  process.emitWarning(
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

async function waitForStableLayout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

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
 * cares about. `'none'` means we are validating against committed baselines.
 * The other values (`'all'`, `'missing'`, `'changed'`) only count as authoring
 * when the application's update script also set `CINDER_UPDATE_SNAPSHOTS=1`; Playwright
 * can otherwise default local runs to `'missing'`, and block mode must still
 * fail with the project-specific update-baselines message.
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
 * Whether Playwright is in the application's baseline-authoring state, in which a
 * missing baseline is expected and must NOT trigger the guard.
 *
 * Written as an exhaustive switch over every {@link UpdateSnapshotsState}
 * literal rather than `!== 'none'`: the `never`-typed default makes any literal
 * Playwright adds to its `updateSnapshots` union a compile-time error here,
 * forcing a deliberate validate-vs-author decision instead of silently treating
 * the new mode as authoring and suppressing the missing-baseline guard.
 */
function isAuthoringState(
  updateSnapshots: UpdateSnapshotsState,
  explicitUpdateRun: boolean,
): boolean {
  switch (updateSnapshots) {
    case 'none':
      // Validating against committed baselines — the guard may fire.
      return false;
    case 'all':
    case 'changed':
    case 'missing':
      // Playwright defaults to writing missing snapshots in local runs. The application
      // only treats this as baseline authoring when the update script has set
      // the explicit repo-owned marker.
      return explicitUpdateRun;
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
 * developer authors a baseline via the documented application workflow, or (b) the
 * run is explicitly an update run. Playwright's default missing-snapshot
 * message reports that a snapshot is absent but not how this repo expects you
 * to produce one, so we substitute a message that names the update command.
 *
 * Stays silent (returns `{ ok: true }`) when Playwright is in an update state,
 * or when the baseline exists and the comparison is running inside the
 * application workflow.
 *
 * @param baselinePath - Absolute path to the expected committed baseline PNG.
 * @param baselineExists - Whether that file is present on disk.
 * @param updateSnapshots - Playwright's `config.updateSnapshots` value.
 * @param explicitUpdateRun - Whether the application's update script is intentionally authoring baselines.
 */
export function blockBaselineGuard(
  baselinePath: string,
  baselineExists: boolean,
  updateSnapshots: UpdateSnapshotsState,
  explicitUpdateRun = environmentConfiguration().cinderUpdateSnapshots,
): BlockBaselineGuardResult {
  if (isAuthoringState(updateSnapshots, explicitUpdateRun)) {
    return { ok: true };
  }

  if (baselineExists) {
    return { ok: true };
  }

  const message = [
    'Visual-regression baseline missing (CINDER_VISUAL_DIFF=block):',
    `  ${baselinePath}`,
    '',
    'Block mode compares against committed baselines, but none exists for this case.',
    'To author missing or changed baselines, run:',
    '',
    '  bun run test:browser:update',
    '',
    'Then rerun the root visual regression command:',
    '',
    '  bun run test:browser:visual',
  ].join('\n');

  return { ok: false, message };
}

export function isScreenshotInComponentScope(
  slug: string,
  rawComponentScope = environmentConfiguration().cinderTestComponents,
  knownSlugs?: ReadonlySet<string>,
): boolean {
  if (parseComponentScopeValue(rawComponentScope).length === 0) return true;

  const manifestSlugs = knownSlugs ?? manifestSlugSet();
  const scope = parseComponentFilter(rawComponentScope, manifestSlugs);
  return scope === null || scope.has(slug);
}

let cachedManifestSlugSet: ReadonlySet<string> | undefined;

function manifestSlugSet(): ReadonlySet<string> {
  cachedManifestSlugSet ??= new Set(loadManifest().map((component) => component.slug));
  return cachedManifestSlugSet;
}

// ---------------------------------------------------------------------------
// Report-mode helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic worker-safe path for a report fragment.
 * Uses a sha256 of the testId so filenames stay filesystem-safe.
 */
function reportFragmentPath(testId: string, key: ArtifactKey): string {
  const hash = createHash('sha256')
    .update(JSON.stringify([testId, key.slug, key.theme, key.viewport, key.fixture]))
    .digest('hex');
  const workerId = environmentConfiguration().testWorkerIndex ?? '0';
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

function screenshotName(key: ArtifactKey): [string, string] {
  return [key.slug, `${key.theme}-${key.viewport}-${key.fixture}.png`];
}

function screenshotBaselinePath(key: ArtifactKey, testInfo: TestInfo): string {
  return testInfo.snapshotPath(...screenshotName(key));
}

function screenshotOptions(
  page: Page,
  options: CaptureScreenshotOptions | undefined,
): ToHaveScreenshotOptions {
  const snapshotOptions: ToHaveScreenshotOptions = { ...SNAPSHOT_DIFF_OPTIONS };

  if (options?.masks !== undefined && options.masks.length > 0) {
    snapshotOptions.mask = masksToLocators(page, options.masks);
  }

  return snapshotOptions;
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
  if (!isScreenshotInComponentScope(key.slug)) {
    return;
  }

  await page.addStyleTag({ content: ANIMATION_KILL_CSS });
  // Use string form to avoid a TypeScript dom-lib dependency; runs in browser context.
  await page.evaluate('document.fonts.ready');
  // The fixture has already waited for `#app > *`, but components using
  // ResizeObserver (such as virtualized DataGrid) settle their measured layout
  // on a subsequent animation frame. Two frames let observer-driven writes
  // commit before the screenshot without introducing an arbitrary timeout.
  await waitForStableLayout(page);

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
  const { expect, test } = await import('@playwright/test');
  const testInfo = test.info();
  // Fail fast with an actionable message when the committed baseline is absent
  // and we are validating (not authoring). Playwright's default missing-snapshot
  // error does not point at the application's update workflow.
  const baseline = screenshotBaselinePath(key, testInfo);
  const guard = blockBaselineGuard(baseline, existsSync(baseline), testInfo.config.updateSnapshots);
  if (!guard.ok) {
    throw new Error(guard.message);
  }

  // Pass [slug, filename] so the app's snapshotPathTemplate resolves the
  // baseline under snapshots/<projectName>/<platform>/<slug>/filename.
  await expect(page).toHaveScreenshot(screenshotName(key), screenshotOptions(page, options));
}

function diffPixelsFromError(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const diffMatch = /(\d+) pixels?/.exec(message);
  const pixelString = diffMatch?.[1];
  return pixelString !== undefined ? parseInt(pixelString, 10) : -1;
}

async function attachDiffIfPresent(testInfo: TestInfo, attachmentsBefore: number): Promise<void> {
  const diffAttachment = testInfo.attachments
    .slice(attachmentsBefore)
    .find((attachment) => attachment.name === 'diff' && attachment.path !== undefined);
  if (diffAttachment?.path === undefined) return;

  await testInfo.attach('visual-diff', {
    path: diffAttachment.path,
    contentType: 'image/png',
  });
}

async function captureReportMode(
  page: Page,
  key: ArtifactKey,
  options: CaptureScreenshotOptions | undefined,
): Promise<void> {
  const { expect, test } = await import('@playwright/test');
  const testInfo = test.info();
  const baseline = screenshotBaselinePath(key, testInfo);

  // Report mode is optional diagnostics: skip silently when no baseline is
  // committed. Block mode remains the validation gate for missing baselines.
  if (!existsSync(baseline)) {
    return;
  }

  const attachmentsBefore = testInfo.attachments.length;

  try {
    await expect(page).toHaveScreenshot(screenshotName(key), screenshotOptions(page, options));
  } catch (error) {
    const fragment: ReportFragment = {
      testId: testInfo.testId,
      slug: key.slug,
      theme: key.theme,
      viewport: key.viewport,
      fixture: key.fixture,
      diffPixels: diffPixelsFromError(error),
    };

    const fragmentPath = reportFragmentPath(testInfo.testId, key);
    await mkdir(dirname(fragmentPath), { recursive: true });
    await writeFile(fragmentPath, JSON.stringify(fragment, null, 2));

    await attachDiffIfPresent(testInfo, attachmentsBefore);
    // Never throw in report mode — the fragment records the mismatch.
  }
}
