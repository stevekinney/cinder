/**
 * Compute the set of component slugs touched by a diff, or signal that the
 * full matrix must run.
 *
 * Reads newline-separated file paths from stdin (the output of
 * `git diff --name-only <base>..HEAD`) and prints one of two outputs to
 * stdout:
 *
 *   mode=full
 *
 * — when any changed file falls outside the "safe" set (workflow files,
 * `packages/components/src/components/<slug>.svelte`, that slug's `.a11y.md`
 * / `.test.ts` / `.type-test.ts` siblings, and
 * `packages/playground/src/examples/<slug>/**`). A change to a shared
 * utility, an `_internal/*` helper, the playground server, or any of the
 * `editor` / `markdown` / `commentary` / `diff` packages can affect every
 * component's bundle, so the full suite is the only safe scope.
 *
 *   mode=filtered components=accordion,button,...
 *
 * — when every changed file maps to a known component slug. The
 * `components` list is sorted, deduped, and never empty (the caller drops
 * to `mode=full` if the changed-set is empty).
 *
 * Designed for CI: invoked from `.github/workflows/browser-tests.yaml` to
 * decide whether to set `CINDER_TEST_COMPONENTS` for the Playwright suite.
 */

const componentFilePattern =
  /^packages\/components\/src\/components\/([a-z0-9][a-z0-9-]*)\.(svelte|a11y\.md|test\.ts|type-test\.ts)$/;
const exampleFilePattern = /^packages\/playground\/src\/examples\/([a-z0-9][a-z0-9-]*)\//;

/**
 * Files that don't affect component bundles at all and can be ignored when
 * deciding scope. Touching only these falls through to "no components
 * changed" and the caller drops to `mode=full` to keep main branches safe.
 */
const ignorablePatterns: RegExp[] = [
  /^\.github\/workflows\/browser-tests\.yaml$/,
  /^packages\/testing\//,
  /^README\.md$/,
  /^\.gitignore$/,
];

export type Decision =
  | { mode: 'full'; reason: string }
  | { mode: 'filtered'; components: string[] };

export function decide(changedFiles: string[]): Decision {
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

  return { mode: 'filtered', components: [...slugs].toSorted() };
}

async function readStdin(): Promise<string> {
  const { stdin } = await import('node:process');
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function main(): Promise<void> {
  const input = await readStdin();
  const lines = input.split('\n');
  const decision = decide(lines);

  if (decision.mode === 'full') {
    process.stdout.write('mode=full\n');
    process.stderr.write(`changed-components: ${decision.reason}\n`);
    return;
  }

  process.stdout.write('mode=filtered\n');
  process.stdout.write(`components=${decision.components.join(',')}\n`);
  process.stderr.write(
    `changed-components: ${decision.components.length} component(s): ${decision.components.join(', ')}\n`,
  );
}

const invokedAsScript =
  typeof process.argv[1] === 'string' && process.argv[1].endsWith('changed-components.ts');

if (invokedAsScript) {
  main().catch((error: unknown) => {
    process.stderr.write(`changed-components failed: ${String(error)}\n`);
    process.exit(1);
  });
}
