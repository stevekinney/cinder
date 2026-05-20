/**
 * Verify that every component × theme × viewport × fixture combination has a
 * committed baseline snapshot on disk.
 *
 * Exits 0 when all baselines are present.
 * Exits 1 with a clear list of missing slug/theme/viewport/fixture keys when
 * any baseline is absent.
 *
 * This script is intended for CI: run it in a job that does NOT set
 * `CINDER_VISUAL_DIFF=block` so that missing baselines are reported in one
 * place rather than failing individual Playwright tests.
 *
 * Usage:
 *   bun run scripts/baseline-coverage-check.ts
 */

import { existsSync } from 'node:fs';
import { snapshotPath } from '../src/helpers/artifact-path.ts';
import { loadManifest, THEMES, VIEWPORTS } from '../src/helpers/manifest.ts';

/** The synthesised default fixture used when a component has no explicit fixture list. */
const DEFAULT_FIXTURE = [{ name: 'default' }] as const;

type MissingBaseline = {
  slug: string;
  theme: string;
  viewport: string;
  fixture: string;
  expectedPath: string;
};

/**
 * Checks all manifest entries and returns the list of missing baseline snapshots.
 *
 * @param entries - Component entries from the manifest (or a fake manifest in tests).
 * @returns Array of missing baseline descriptors; empty when everything is present.
 */
export function findMissingBaselines(entries: ReturnType<typeof loadManifest>): MissingBaseline[] {
  const missing: MissingBaseline[] = [];

  for (const entry of entries) {
    const fixtures =
      entry.fixtures !== undefined && entry.fixtures.length > 0 ? entry.fixtures : DEFAULT_FIXTURE;

    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        for (const fixture of fixtures) {
          const key = {
            slug: entry.slug,
            theme,
            viewport: viewport.name,
            fixture: fixture.name,
          };
          const expectedPath = snapshotPath(key);
          if (!existsSync(expectedPath)) {
            missing.push({
              slug: entry.slug,
              theme,
              viewport: viewport.name,
              fixture: fixture.name,
              expectedPath,
            });
          }
        }
      }
    }
  }

  return missing;
}

async function main(): Promise<void> {
  let entries: ReturnType<typeof loadManifest>;
  try {
    entries = loadManifest();
  } catch (error) {
    process.stderr.write(`baseline-coverage-check: failed to load manifest — ${String(error)}\n`);
    process.exit(1);
  }

  const missing = findMissingBaselines(entries);

  if (missing.length === 0) {
    process.stdout.write('baseline-coverage-check: all baselines present.\n');
    process.exit(0);
  }

  process.stderr.write(`baseline-coverage-check: ${missing.length} missing baseline(s):\n`);
  for (const item of missing) {
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
