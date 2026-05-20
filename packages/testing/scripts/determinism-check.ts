import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { loadManifest, THEMES, VIEWPORTS } from '../src/helpers/manifest.ts';
import { checkDockerAuthenticity, formatFailures } from './docker-authenticity.ts';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolvePath(here, '..');
const repoRoot = resolvePath(packageRoot, '../..');

const RUN_COUNT = 10;
const MAX_DIFF_PIXELS = 2;
const PIXEL_THRESHOLD = 0.1;

type DeterminismConfig = {
  componentSlugs: string[] | null;
  exclusions: string[];
};

function readConfig(): DeterminismConfig {
  const path = resolvePath(packageRoot, 'determinism-config.json');
  if (!existsSync(path)) {
    return { componentSlugs: null, exclusions: [] };
  }
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as Partial<DeterminismConfig>;
  return {
    componentSlugs: Array.isArray(parsed.componentSlugs) ? parsed.componentSlugs : null,
    exclusions: Array.isArray(parsed.exclusions) ? parsed.exclusions : [],
  };
}

function selectComponentSlugs(config: DeterminismConfig): string[] {
  const all = loadManifest().map((entry) => entry.slug);
  const excluded = new Set(config.exclusions);
  if (config.componentSlugs === null) {
    return all.filter((slug) => !excluded.has(slug));
  }
  return config.componentSlugs.filter((slug) => !excluded.has(slug));
}

/**
 * Runs the Playwright capture loop once, returning the directory containing
 * the PNGs for this run. Each run lives in `tmp/determinism/run-<n>/`.
 */
function runCaptureLoop(runIndex: number, componentSlugs: string[]): string {
  const runRoot = resolvePath(packageRoot, 'tmp', 'determinism', `run-${runIndex}`);
  mkdirSync(runRoot, { recursive: true });

  const result = spawnSync('bun', ['run', 'scripts/start-server.ts'], {
    cwd: packageRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      CINDER_TEST_COMPONENTS: componentSlugs.join(','),
      // Force legacy capture; we'll compare from disk ourselves.
      CINDER_VISUAL_DIFF: 'off',
      CINDER_DETERMINISM_RUN: String(runIndex),
      CINDER_DETERMINISM_OUTPUT: runRoot,
    },
  });
  if (result.status !== 0) {
    throw new Error(`determinism run ${runIndex} failed with status ${result.status}`);
  }
  return runRoot;
}

/**
 * Compare a pair of PNG files using pixelmatch. Returns the number of pixels
 * that differ at the configured threshold. Throws if either file is missing
 * or dimensions disagree.
 */
function compareImages(pathA: string, pathB: string): number {
  if (!existsSync(pathA) || !existsSync(pathB)) {
    throw new Error(`Missing image for comparison: ${pathA} vs ${pathB}`);
  }
  const imageA = PNG.sync.read(readFileSync(pathA));
  const imageB = PNG.sync.read(readFileSync(pathB));
  if (imageA.width !== imageB.width || imageA.height !== imageB.height) {
    throw new Error(
      `Dimension mismatch: ${pathA} (${imageA.width}x${imageA.height}) vs ${pathB} (${imageB.width}x${imageB.height})`,
    );
  }
  const diff = new PNG({ width: imageA.width, height: imageA.height });
  return pixelmatch(imageA.data, imageB.data, diff.data, imageA.width, imageA.height, {
    threshold: PIXEL_THRESHOLD,
  });
}

type FailureReport = {
  slug: string;
  theme: string;
  viewport: string;
  runIndex: number;
  diffPixels: number;
};

function compareRuns(runDirs: string[], slugs: string[]): FailureReport[] {
  const failures: FailureReport[] = [];
  for (const slug of slugs) {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const baseName = `${theme}-${viewport.name}-default.png`;
        const referencePath = resolvePath(runDirs[0]!, slug, baseName);
        if (!existsSync(referencePath)) continue;
        for (let i = 1; i < runDirs.length; i += 1) {
          const candidatePath = resolvePath(runDirs[i]!, slug, baseName);
          const diffPixels = compareImages(referencePath, candidatePath);
          if (diffPixels > MAX_DIFF_PIXELS) {
            failures.push({
              slug,
              theme,
              viewport: viewport.name,
              runIndex: i,
              diffPixels,
            });
          }
        }
      }
    }
  }
  return failures;
}

/**
 * Phase 1 determinism gate.
 *
 * Captures the playground component matrix N times inside the canonical
 * Playwright Docker image and compares run 2..N against run 1 with
 * pixelmatch. Pass = every comparison stays under maxDiffPixels:2 at
 * threshold:0.1. The harness deletes its `tmp/determinism/` artifacts
 * on success.
 *
 * Failures: prints a table of (slug, theme, viewport, runIndex, diffPixels)
 * so the offender is named.
 */
async function main(): Promise<void> {
  const authenticity = await checkDockerAuthenticity(resolvePath(packageRoot, 'package.json'));
  if (!authenticity.ok) {
    console.error(formatFailures(authenticity.failures));
    process.exit(1);
  }

  const config = readConfig();
  const componentSlugs = selectComponentSlugs(config);
  if (componentSlugs.length === 0) {
    console.error('No components selected for determinism check.');
    process.exit(1);
  }

  console.log(`Determinism gate: ${RUN_COUNT} runs over ${componentSlugs.length} component(s).`);
  if (config.exclusions.length > 0) {
    console.log(`Excluded: ${config.exclusions.join(', ')}`);
  }

  const runDirs: string[] = [];
  for (let i = 0; i < RUN_COUNT; i += 1) {
    console.log(`\n--- Run ${i + 1}/${RUN_COUNT} ---`);
    runDirs.push(runCaptureLoop(i, componentSlugs));
  }

  console.log('\nComparing runs...');
  const failures = compareRuns(runDirs, componentSlugs);

  if (failures.length > 0) {
    console.error(`\nDeterminism gate FAILED: ${failures.length} unstable case(s).`);
    for (const failure of failures) {
      console.error(
        `  ${failure.slug}  ${failure.theme}-${failure.viewport}  ` +
          `run ${failure.runIndex}: ${failure.diffPixels} differing pixels`,
      );
    }
    console.error(`\nThreshold: maxDiffPixels=${MAX_DIFF_PIXELS} at threshold=${PIXEL_THRESHOLD}.`);
    console.error(`Artifacts retained at: ${resolvePath(packageRoot, 'tmp', 'determinism')}`);
    process.exit(1);
  }

  console.log(
    `\nDeterminism gate PASSED: ${RUN_COUNT} runs, ${componentSlugs.length} components, ` +
      `0 unstable cases at maxDiffPixels=${MAX_DIFF_PIXELS}, threshold=${PIXEL_THRESHOLD}.`,
  );

  // Clean up artifacts on success.
  const root = resolvePath(packageRoot, 'tmp', 'determinism');
  rmSync(root, { recursive: true, force: true });
  console.log(`Cleaned ${root}.`);

  // Suppress repo-root unused-import lint on these two — the runtime spawn
  // doesn't need them, but the type checker validates the helpers.
  void repoRoot;
}

main().catch((error: unknown) => {
  console.error('determinism-check failed:', error);
  process.exit(1);
});
