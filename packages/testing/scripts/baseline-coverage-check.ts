/**
 * Verify baseline snapshot coverage for the components that have actually
 * adopted visual baselines.
 *
 * Baselines are being adopted incrementally: only a handful of the ~173
 * manifest components have committed snapshots. Asserting the full
 * component × theme × viewport × fixture grid therefore reported ~1150 missing
 * baselines and could never pass, which is why the CI job was fenced behind
 * `CINDER_VISUAL_DIFF != 'off'` and effectively never ran.
 *
 * The check is now scoped per slug:
 *
 *   - A slug is **adopted** once `snapshots/<slug>/` holds at least one PNG for
 *     a combination the suite currently expects. Adopted slugs must have *all*
 *     of their combinations, so a newly added fixture or viewport cannot land
 *     half-covered.
 *   - Un-adopted slugs are reported as **pending** and do not fail the check.
 *   - PNGs that match no expected combination are reported as **orphans**.
 *     Orphans are advisory only — the script never deletes anything, because a
 *     stale-looking baseline may still be the most recent authored artifact.
 *
 * Exits 1 only when an adopted slug is missing one of its combinations.
 *
 * Usage (from the repo root, as CI invokes it):
 *   bun run packages/testing/scripts/baseline-coverage-check.ts
 *
 * Scope it with CINDER_TEST_COMPONENTS to a comma-separated slug list, matching
 * the `scope` job's filtered output:
 *   CINDER_TEST_COMPONENTS=mega-menu bun run packages/testing/scripts/baseline-coverage-check.ts
 */

import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotPath } from '../src/helpers/artifact-path.ts';
import { applyComponentFilter, parseComponentFilter } from '../src/helpers/component-filter.ts';
import type { Theme, ViewportName } from '../src/helpers/manifest.ts';
import { loadManifest, THEMES, VIEWPORTS } from '../src/helpers/manifest.ts';

/** The synthesised default fixture used when a component has no explicit fixture list. */
const DEFAULT_FIXTURE = [{ name: 'default' }] as const;

/** How many pending slugs to name before collapsing the rest into a count. */
const PENDING_PREVIEW_LIMIT = 25;

type BaselineManifestEntry = {
  slug: string;
  fixtures?: readonly { name: string; interact?: readonly unknown[] }[];
  includeDefaultFixture?: boolean;
};

type MissingBaseline = {
  slug: string;
  theme: string;
  viewport: string;
  fixture: string;
  expectedPath: string;
};

export type TargetedCombination = {
  slug: string;
  theme: Theme;
  viewport: ViewportName;
  fixture: string;
};

function capturedFixtureNames(fixture: { name: string; interact?: readonly unknown[] }): string[] {
  return fixture.interact !== undefined && fixture.interact.length > 0
    ? [`${fixture.name}-resting`, fixture.name]
    : [fixture.name];
}

function fixturesForEntry(entry: BaselineManifestEntry) {
  if (entry.fixtures === undefined || entry.fixtures.length === 0) return DEFAULT_FIXTURE;
  return entry.includeDefaultFixture === true
    ? [...DEFAULT_FIXTURE, ...entry.fixtures]
    : entry.fixtures;
}

/**
 * A baseline combination captured by a hand-written targeted test rather than
 * by the generated component sweep in `tests/components.playwright.ts`.
 *
 * These are NOT derivable from the manifest: the fixture names live only in the
 * targeted test files. Omitting them makes orphan detection flag the most
 * recently authored baselines in the repo (see `snapshots/provenance.json`,
 * which records `componentScope: ["mega-menu"]`) as stale.
 *
 * Verified call sites:
 *   - `tests/mega-menu.playwright.ts` → `mega-menu` @ `nested-open`, `accessibility`
 *   - `tests/overlay-positioning.playwright.ts` → `popover` and `tooltip`
 *     @ `transformed-ancestor-shell`
 */
export const TARGETED_TEST_COMBINATIONS = [
  { slug: 'mega-menu', theme: 'light', viewport: 'desktop', fixture: 'nested-open' },
  { slug: 'mega-menu', theme: 'light', viewport: 'desktop', fixture: 'accessibility' },
  { slug: 'popover', theme: 'light', viewport: 'desktop', fixture: 'transformed-ancestor-shell' },
  { slug: 'tooltip', theme: 'light', viewport: 'desktop', fixture: 'transformed-ancestor-shell' },
] as const satisfies readonly TargetedCombination[];

export type OrphanBaseline = {
  slug: string;
  fileName: string;
};

export type BaselineCoverageReport = {
  /** Slugs with at least one recognised baseline PNG on disk, sorted. */
  adoptedSlugs: string[];
  /** Slugs with no recognised baseline PNG yet, sorted. */
  pendingSlugs: string[];
  /** Missing combinations, restricted to adopted slugs. */
  missing: MissingBaseline[];
  /** Total slugs considered (adopted + pending). */
  totalSlugs: number;
};

/**
 * Checks all manifest entries and returns the list of missing baseline snapshots.
 *
 * Intentionally unscoped: callers decide which entries to hand in. Behaviour is
 * unchanged from the original full-grid implementation.
 *
 * @param entries - Component entries from the manifest (or a fake manifest in tests).
 * @returns Array of missing baseline descriptors; empty when everything is present.
 */
export function findMissingBaselines(entries: readonly BaselineManifestEntry[]): MissingBaseline[] {
  const missing: MissingBaseline[] = [];

  for (const entry of entries) {
    const fixtures = fixturesForEntry(entry);

    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        for (const fixture of fixtures) {
          for (const fixtureName of capturedFixtureNames(fixture)) {
            const key = {
              slug: entry.slug,
              theme,
              viewport: viewport.name,
              fixture: fixtureName,
            };
            const expectedPath = snapshotPath(key);
            if (!existsSync(expectedPath)) {
              missing.push({
                slug: entry.slug,
                theme,
                viewport: viewport.name,
                fixture: fixtureName,
                expectedPath,
              });
            }
          }
        }
      }
    }
  }

  return missing;
}

export function applyBaselineComponentFilter<Entry extends BaselineManifestEntry>(
  entries: readonly Entry[],
  rawComponentScope: string | undefined,
): readonly Entry[] {
  const knownSlugs = new Set(entries.map((entry) => entry.slug));
  const filter = parseComponentFilter(rawComponentScope, knownSlugs);
  return [...applyComponentFilter(entries, filter)];
}

/** Default location of the committed baseline tree: `packages/testing/snapshots`. */
export function defaultSnapshotsDirectory(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'snapshots');
}

/**
 * Maps each slug to the set of baseline file names the suite can currently
 * produce for it: the manifest's theme × viewport × fixture grid, unioned with
 * the fixture keys captured by targeted test files.
 */
export function expectedBaselineFileNames(
  entries: readonly BaselineManifestEntry[],
  targeted: readonly TargetedCombination[] = TARGETED_TEST_COMBINATIONS,
): Map<string, Set<string>> {
  const expected = new Map<string, Set<string>>();

  for (const [slug, combinations] of expectedBaselineCombinations(entries, targeted)) {
    expected.set(
      slug,
      new Set(combinations.map((combination) => basename(snapshotPath(combination)))),
    );
  }

  return expected;
}

/**
 * The single source of truth for "what baselines should exist for this slug":
 * the manifest's theme × viewport × fixture grid, unioned with the combinations
 * captured by targeted test files.
 *
 * Both halves of the check read from this. Deriving only the ORPHAN half from
 * the union while the MISSING half read the manifest grid alone left the two
 * disagreeing about what "expected" means: a deleted `mega-menu` targeted
 * baseline would not be flagged missing here, and would then fail late and
 * opaquely inside `blockBaselineGuard` in block mode.
 */
export function expectedBaselineCombinations(
  entries: readonly BaselineManifestEntry[],
  targeted: readonly TargetedCombination[] = TARGETED_TEST_COMBINATIONS,
): Map<string, TargetedCombination[]> {
  const expected = new Map<string, TargetedCombination[]>();
  const seen = new Map<string, Set<string>>();

  const add = (slug: string, theme: Theme, viewport: ViewportName, fixture: string): void => {
    const key = `${theme} ${viewport} ${fixture}`;
    const slugSeen = seen.get(slug);
    if (slugSeen === undefined) {
      seen.set(slug, new Set([key]));
      expected.set(slug, [{ slug, theme, viewport, fixture }]);
      return;
    }
    if (slugSeen.has(key)) return;
    slugSeen.add(key);
    expected.get(slug)?.push({ slug, theme, viewport, fixture });
  };

  for (const entry of entries) {
    const fixtures = fixturesForEntry(entry);
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        for (const fixture of fixtures) {
          for (const fixtureName of capturedFixtureNames(fixture)) {
            add(entry.slug, theme, viewport.name, fixtureName);
          }
        }
      }
    }
  }

  for (const combination of targeted) {
    add(combination.slug, combination.theme, combination.viewport, combination.fixture);
  }

  return expected;
}

/**
 * Reads the committed baseline tree and returns the PNG file names per slug.
 * Non-PNG entries (`provenance.json`) and a missing directory are ignored.
 */
export function readBaselineFiles(
  snapshotsDirectory: string = defaultSnapshotsDirectory(),
): Map<string, string[]> {
  const found = new Map<string, string[]>();
  if (!existsSync(snapshotsDirectory)) return found;

  for (const slugEntry of readdirSync(snapshotsDirectory, { withFileTypes: true })) {
    if (!slugEntry.isDirectory()) continue;
    const files = readdirSync(resolve(snapshotsDirectory, slugEntry.name), {
      withFileTypes: true,
    })
      .filter((file) => file.isFile() && file.name.endsWith('.png'))
      .map((file) => file.name)
      .sort();
    if (files.length > 0) found.set(slugEntry.name, files);
  }

  return found;
}

/**
 * A slug counts as adopted once it has at least one PNG matching a combination
 * the suite currently expects.
 *
 * Note the "matching an expected combination" qualifier: a directory holding
 * *only* unreachable PNGs (e.g. `snapshots/button/*-default.png`, left behind
 * when button's fixtures became primary/danger/focused/hovered) is not adopted.
 * Counting those would make the check demand 24 baselines nobody has authored
 * and keep the job permanently red — the exact failure mode this rework fixes.
 * Those files are surfaced as orphans instead.
 */
export function isAdoptedSlug(
  fileNames: readonly string[] | undefined,
  expectedFileNames: ReadonlySet<string> | undefined,
): boolean {
  if (fileNames === undefined || expectedFileNames === undefined) return false;
  return fileNames.some((fileName) => expectedFileNames.has(fileName));
}

/**
 * Scopes the full-grid coverage assertion to slugs that have adopted baselines.
 *
 * @param entries - Manifest entries in scope (already component-filtered).
 * @param baselineFiles - PNG file names per slug, from {@link readBaselineFiles}.
 */
export function evaluateBaselineCoverage(
  entries: readonly BaselineManifestEntry[],
  baselineFiles: ReadonlyMap<string, readonly string[]>,
  targeted: readonly TargetedCombination[] = TARGETED_TEST_COMBINATIONS,
): BaselineCoverageReport {
  const combinations = expectedBaselineCombinations(entries, targeted);
  const expected = expectedBaselineFileNames(entries, targeted);
  const adopted: BaselineManifestEntry[] = [];
  const pendingSlugs: string[] = [];

  for (const entry of entries) {
    if (isAdoptedSlug(baselineFiles.get(entry.slug), expected.get(entry.slug))) {
      adopted.push(entry);
    } else {
      pendingSlugs.push(entry.slug);
    }
  }

  // Diff the FULL expected set (manifest grid ∪ targeted combinations) against
  // disk, not just the manifest grid — otherwise a targeted-test baseline could
  // go missing without this check saying anything, which is precisely the class
  // of silent gap the union exists to close on the orphan side.
  const missing: MissingBaseline[] = [];
  for (const entry of adopted) {
    for (const combination of combinations.get(entry.slug) ?? []) {
      const expectedPath = snapshotPath(combination);
      if (!existsSync(expectedPath)) {
        missing.push({
          slug: combination.slug,
          theme: combination.theme,
          viewport: combination.viewport,
          fixture: combination.fixture,
          expectedPath,
        });
      }
    }
  }

  return {
    adoptedSlugs: adopted.map((entry) => entry.slug).sort(),
    pendingSlugs: pendingSlugs.sort(),
    missing,
    totalSlugs: entries.length,
  };
}

/**
 * Reports committed PNGs that match no combination the suite can currently
 * produce. Purely informational — nothing is deleted, and orphans never fail
 * the check.
 */
export function findOrphanBaselines(
  baselineFiles: ReadonlyMap<string, readonly string[]>,
  expectedFileNames: ReadonlyMap<string, ReadonlySet<string>>,
): OrphanBaseline[] {
  const orphans: OrphanBaseline[] = [];

  for (const [slug, fileNames] of baselineFiles) {
    const expected = expectedFileNames.get(slug);
    for (const fileName of fileNames) {
      if (expected?.has(fileName) !== true) orphans.push({ slug, fileName });
    }
  }

  return orphans.sort(
    (left, right) =>
      left.slug.localeCompare(right.slug) || left.fileName.localeCompare(right.fileName),
  );
}

async function main(): Promise<void> {
  let entries: ReturnType<typeof loadManifest>;
  try {
    entries = loadManifest();
  } catch (error) {
    process.stderr.write(`baseline-coverage-check: failed to load manifest — ${String(error)}\n`);
    process.exit(1);
  }

  const rawComponentScope = process.env['CINDER_TEST_COMPONENTS'];
  let filteredEntries: readonly BaselineManifestEntry[];
  try {
    filteredEntries = applyBaselineComponentFilter(entries, rawComponentScope);
  } catch (error) {
    process.stderr.write(`baseline-coverage-check: invalid component scope — ${String(error)}\n`);
    process.exit(1);
  }

  const allBaselineFiles = readBaselineFiles();

  // A component filter must not make every out-of-scope slug look orphaned.
  const scopedSlugs = new Set(filteredEntries.map((entry) => entry.slug));
  const isFiltered = filteredEntries.length !== entries.length;
  const baselineFiles = isFiltered
    ? new Map([...allBaselineFiles].filter(([slug]) => scopedSlugs.has(slug)))
    : allBaselineFiles;

  const report = evaluateBaselineCoverage(filteredEntries, baselineFiles);
  const orphans = findOrphanBaselines(
    baselineFiles,
    expectedBaselineFileNames(filteredEntries, TARGETED_TEST_COMBINATIONS),
  );

  // Printed on every run — adoption progress is the number reviewers need to
  // see, and it is invisible when the check merely says "all baselines present".
  process.stdout.write(
    `baseline-coverage-check: ${report.adoptedSlugs.length}/${report.totalSlugs} component(s) have adopted baselines.\n`,
  );
  if (report.pendingSlugs.length > 0) {
    // The pending list is long during incremental adoption; cap it so the
    // adopted/total headline and any real failure stay readable in CI logs.
    const shown = report.pendingSlugs.slice(0, PENDING_PREVIEW_LIMIT);
    const overflow = report.pendingSlugs.length - shown.length;
    process.stdout.write(
      `  ${report.pendingSlugs.length} pending (no baselines yet, not enforced): ` +
        `${shown.join(', ')}${overflow > 0 ? `, … and ${overflow} more` : ''}\n`,
    );
  }
  if (orphans.length > 0) {
    process.stdout.write(
      `  ${orphans.length} orphan baseline(s) match no current combination (reported only; nothing deleted):\n`,
    );
    for (const orphan of orphans) {
      process.stdout.write(`    snapshots/${orphan.slug}/${orphan.fileName}\n`);
    }
  }

  if (report.missing.length === 0) {
    process.stdout.write('baseline-coverage-check: all adopted baselines present.\n');
    process.exit(0);
  }

  process.stderr.write(
    `baseline-coverage-check: ${report.missing.length} missing baseline(s) for adopted component(s):\n`,
  );
  for (const item of report.missing) {
    process.stderr.write(
      `  ${item.slug}  ${item.theme}  ${item.viewport}  ${item.fixture}\n` +
        `    expected: ${item.expectedPath}\n`,
    );
  }
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`baseline-coverage-check failed: ${String(error)}\n`);
    process.exit(1);
  });
}
