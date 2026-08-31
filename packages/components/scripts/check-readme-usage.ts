/**
 * PR-lane guard for the README `## Usage` fence contract.
 *
 * The expensive half of this contract — does the fence actually COMPILE
 * against the published API — necessarily lives in
 * `validate:consumer:readme-usage-examples`, which needs a packed tarball
 * installed into the typescript-consumer fixture and so can only run in
 * `main-green` and the release path. The cheap half is pure text analysis:
 * does every component README have a `## Usage` heading, is the first fence
 * under it a ```svelte fence, and does that fence render the component's own
 * tag. Nothing about that needs an install.
 *
 * Leaving BOTH halves post-merge is what let #1471 land fifteen components
 * whose READMEs had no `## Usage` heading at all, turning `main-green` red for
 * three days and silently blocking the `0.25.0` publish (`release.yaml` waits
 * on a same-SHA `main-green` run). This script moves the structural half into
 * the PR-required `unit-tests` lane, so that class fails on the pull request
 * that introduces it instead of after merge.
 *
 * Discovery, exemptions, and tag derivation are imported from
 * `readme-usage-contract.mjs` — the same module the compile gate uses — so the
 * two gates cannot drift into disagreeing about who is under contract.
 */

import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractUsageFence, matchesComponentTag } from './extract-readme-usage-example.mjs';
import {
  COMPOSE_ONLY_LEAF_EXEMPTIONS,
  DOTTED_NAMESPACE_ONLY_EXEMPTIONS,
  discoverReadmeComponents,
  toIdentifier,
} from './readme-usage-contract.mjs';

const scriptDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)));
const packageRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(packageRoot, '..', '..');

export type ReadmeUsageFailure = {
  componentId: string;
  reason: 'no-heading' | 'no-fence' | 'no-matching-tag';
  readmePath: string;
};

/**
 * Runs the structural half of the contract over every component README under
 * `rootDirectory`, returning one failure per offending component.
 *
 * Mirrors `generate-readme-usage-examples.mjs`'s checks exactly, minus the
 * `svelte-check` compile step: same discovery, same exemption sets, same
 * `extractUsageFence` grammar, same `matchesComponentTag` word-boundary rule.
 */
export function findReadmeUsageFailures(rootDirectory: string): ReadmeUsageFailure[] {
  const failures: ReadmeUsageFailure[] = [];

  for (const { componentId, directory } of discoverReadmeComponents(rootDirectory)) {
    if (COMPOSE_ONLY_LEAF_EXEMPTIONS.has(componentId)) continue;

    const readmePath = join(directory, 'README.md');
    const extracted = extractUsageFence(readFileSync(readmePath, 'utf8'));

    if ('error' in extracted) {
      failures.push({ componentId, reason: extracted.error, readmePath });
      continue;
    }

    if (DOTTED_NAMESPACE_ONLY_EXEMPTIONS.has(componentId)) continue;
    if (!matchesComponentTag(extracted.code, toIdentifier(componentId))) {
      failures.push({ componentId, reason: 'no-matching-tag', readmePath });
    }
  }

  return failures;
}

const REMEDIES: Record<ReadmeUsageFailure['reason'], string> = {
  'no-heading': 'add a `## Usage` section to the README',
  'no-fence': 'make the first code fence under `## Usage` a ```svelte fence',
  'no-matching-tag': "render the component's own tag inside the `## Usage` fence",
};

if (import.meta.main) {
  const failures = findReadmeUsageFailures(join(packageRoot, 'src', 'components'));

  for (const failure of failures) {
    process.stderr.write(
      `check:readme-usage: ${failure.componentId}: ${failure.reason} — ` +
        `${REMEDIES[failure.reason]} (${relative(repositoryRoot, failure.readmePath)})\n`,
    );
  }

  if (failures.length > 0) {
    process.stderr.write(
      `\ncheck:readme-usage — ${failures.length} component README(s) violate the ` +
        '`## Usage` contract. The same contract is compile-checked post-merge by ' +
        '`validate:consumer:readme-usage-examples`; fixing it here keeps `main-green` ' +
        'green and the release path unblocked.\n',
    );
    process.exit(1);
  }

  process.stdout.write('check:readme-usage — OK\n');
}
