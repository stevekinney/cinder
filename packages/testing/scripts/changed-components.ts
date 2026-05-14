/**
 * Compute the set of component slugs touched by a diff, or signal that the
 * full matrix must run.
 *
 * Reads newline-separated file paths from stdin (the output of
 * `git diff --name-only <base>..HEAD`) and either writes to `$GITHUB_OUTPUT`
 * (when present, for CI consumption) or prints the decision as `key=value`
 * lines to stdout (for local debugging).
 *
 * The decision is `mode=full` when:
 *
 *   - any changed file falls outside the "safe" per-component scope (shared
 *     utilities, `_internal/*` helpers, the playground server, sibling
 *     `editor` / `markdown` / `commentary` / `diff` packages, etc.) — these
 *     can affect every component's bundle, and
 *   - any file under `packages/testing/` other than this narrow allow-list:
 *     the README and this script's own files. Test fixtures, the Playwright
 *     config, and helper modules all affect every test, so changes there
 *     force the full matrix.
 *
 * It is `mode=filtered` with a comma-separated, sorted `components` list when
 * every non-ignorable changed file maps to a known component slug — which
 * is verified against the manifest passed in by the caller, so deleted
 * components or cross-cutting example directories that happen to match the
 * extraction regex (e.g. a `packages/playground/src/examples/shared/`
 * helper directory) fall back to full.
 *
 * Designed for CI: invoked from `.github/workflows/browser-tests.yaml` to
 * decide whether to set `CINDER_TEST_COMPONENTS` for the Playwright suite.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const componentFilePattern =
  /^packages\/components\/src\/components\/([a-z0-9][a-z0-9-]*)\.(svelte|a11y\.md|test\.ts|type-test\.ts)$/;
const exampleFilePattern = /^packages\/playground\/src\/examples\/([a-z0-9][a-z0-9-]*)\//;

/**
 * Files that don't affect component bundles or the test harness, and can be
 * ignored when deciding scope. Touching only these falls through to "no
 * components changed" and the caller drops to `mode=full` to keep main
 * branches safe. Kept deliberately narrow: anything that could change how
 * tests run (fixtures, Playwright config, manifest helpers) must force the
 * full matrix.
 */
const ignorablePatterns: readonly RegExp[] = [
  /^\.github\/workflows\/browser-tests\.yaml$/,
  /^packages\/testing\/README\.md$/,
  /^packages\/testing\/scripts\/changed-components\.(ts|test\.ts)$/,
  /^README\.md$/,
  /^\.gitignore$/,
];

export type Decision =
  | { mode: 'full'; reason: string }
  | { mode: 'filtered'; components: string[] };

/**
 * Decide whether the suite should run in full or filtered mode based on a
 * list of changed file paths.
 *
 * @param changedFiles - newline-stripped file paths from `git diff --name-only`.
 * @param knownSlugs - the set of component slugs currently present in the
 *   manifest. When omitted, slug validation is skipped (used by unit tests
 *   for the path-classification logic in isolation).
 */
export function decide(changedFiles: string[], knownSlugs?: ReadonlySet<string>): Decision {
  const slugs = new Set<string>();

  for (const raw of changedFiles) {
    const path = raw.trim();
    if (path.length === 0) continue;

    if (ignorablePatterns.some((pattern) => pattern.test(path))) continue;

    const componentMatch = componentFilePattern.exec(path);
    if (componentMatch && componentMatch[1] !== undefined) {
      slugs.add(componentMatch[1]);
      continue;
    }

    const exampleMatch = exampleFilePattern.exec(path);
    if (exampleMatch && exampleMatch[1] !== undefined) {
      slugs.add(exampleMatch[1]);
      continue;
    }

    return {
      mode: 'full',
      reason: `Changed file outside per-component scope: ${path}`,
    };
  }

  if (slugs.size === 0) {
    return { mode: 'full', reason: 'No component-scoped changes detected.' };
  }

  if (knownSlugs !== undefined) {
    const unknown = [...slugs].filter((slug) => !knownSlugs.has(slug));
    if (unknown.length > 0) {
      return {
        mode: 'full',
        reason: `Extracted slug(s) not present in manifest: ${unknown.toSorted().join(', ')}`,
      };
    }
  }

  return { mode: 'filtered', components: [...slugs].toSorted() };
}

type ManifestFile = { entries: Array<{ slug: string }> };

async function loadKnownSlugs(): Promise<ReadonlySet<string> | undefined> {
  const here = dirname(fileURLToPath(import.meta.url));
  const manifestPath = resolve(here, '..', '.playwright', 'manifest.json');
  try {
    const raw = await readFile(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw) as ManifestFile;
    return new Set(parsed.entries.map((entry) => entry.slug));
  } catch {
    // No manifest available yet (first-run, clean checkout). Skip slug
    // validation; the spec file's own unknown-slug guard will catch any
    // false positives at suite-load time.
    return undefined;
  }
}

async function emit(decision: Decision): Promise<void> {
  const githubOutput = process.env['GITHUB_OUTPUT'];
  const lines =
    decision.mode === 'full'
      ? ['mode=full', '']
      : ['mode=filtered', `components=${decision.components.join(',')}`, ''];
  const payload = lines.join('\n');

  if (githubOutput !== undefined && githubOutput.length > 0) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(githubOutput, payload, 'utf-8');
  } else {
    process.stdout.write(payload);
  }

  if (decision.mode === 'full') {
    process.stderr.write(`changed-components: ${decision.reason}\n`);
  } else {
    process.stderr.write(
      `changed-components: ${decision.components.length} component(s): ${decision.components.join(', ')}\n`,
    );
  }
}

async function main(): Promise<void> {
  const input = await Bun.stdin.text();
  const lines = input.split('\n');
  const knownSlugs = await loadKnownSlugs();
  const decision = decide(lines, knownSlugs);
  await emit(decision);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`changed-components failed: ${String(error)}\n`);
    process.exit(1);
  });
}
