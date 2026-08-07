/**
 * Compile-checks every component README's `## Usage` fence by materializing
 * it as a standalone `.svelte` file next to `generate-probe.mjs`'s own
 * output, so the SAME `svelte-check` invocation that already scans
 * `fixtures/typescript-consumer/src/generated/` (Gate 3, `--threshold error`)
 * picks these up too, at zero extra install/build/svelte-check cost.
 *
 * Walks `rootDirectory` the same way `discoverComponentDirectories()`
 * (`scripts/discover-component-directories.ts`) walks `src/components/`:
 * underscore-prefixed directories (`_radio`, `_internal`, …) and `icons/`
 * are private/internal and skipped, and `experimental/` is descended one
 * level. That mirrors this glue script directly rather than importing the
 * `.ts` discovery module, because this file is executed by plain `node`
 * with no TypeScript transpilation step (see `to-identifier.mjs`'s doc
 * comment for the same constraint) — and, unlike reading the installed
 * manifest, a plain directory walk needs no tarball install to be testable
 * against a throwaway fixture root.
 *
 * Node baseline: 22+.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractUsageFence,
  matchesComponentTag,
} from '../../scripts/extract-readme-usage-example.mjs';
import { toIdentifier } from './to-identifier.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Compose-only leaf components whose `## Usage` section is deliberately
 * prose-only ("compose-only leaf of `<Parent>`... see the parent README for
 * the composed snippet"), pointing readers at the parent compound
 * component's README instead of duplicating a working example. This is an
 * established, repo-wide documentation convention (verified: every entry
 * below carries the identical "compose-only leaf" sentence), not a bug —
 * porting a redundant standalone example into each of these would
 * contradict the very sentence the README teaches ("the idiomatic API is
 * `Parent.Leaf`, reached through the parent namespace").
 */
const COMPOSE_ONLY_LEAF_EXEMPTIONS = new Set([
  'accordion-item',
  'choice-grid-item',
  'dropdown-item',
  'dropdown-label',
  'dropdown-menu',
  'dropdown-separator',
  'dropdown-trigger',
  'feed-boundary',
  'feed-event',
  'grid-list-item',
  'side-navigation-group',
  'side-navigation-item',
  'statistic',
  'tab',
  'tab-list',
  'tab-panel',
  'table-body',
  'table-cell',
  'table-header',
  'table-header-cell',
  'table-row',
  'tree-item',
]);

/**
 * Compound-leaf components whose `## Usage` fence genuinely compiles and
 * renders — unlike the compose-only-leaf cohort above, which has no code at
 * all — but demonstrates the leaf exclusively through the parent's dotted
 * namespace form (`BentoGrid.Cell`, `Grid.Item`, `SpeedDial.Action`) rather
 * than the leaf's own flat tag. `matchesComponentTag`'s word-boundary regex
 * is deliberately literal (see its doc comment) and does not recognize
 * `Parent.Leaf` as a match for `Leaf`. Rewriting these to the flat tag
 * purely to satisfy the gate would teach the non-idiomatic composition this
 * cluster's root cause explicitly warns against; the dotted form is the
 * correct, idiomatic usage for these three.
 */
const DOTTED_NAMESPACE_ONLY_EXEMPTIONS = new Set(['bento-cell', 'grid-item', 'speed-dial-action']);

/**
 * @param {string} directory
 * @returns {Array<{ componentId: string; directory: string }>}
 */
function discoverComponentDirectories(directory) {
  const results = [];
  for (const name of readdirSync(directory).sort()) {
    if (name.startsWith('_')) continue;
    if (name === 'icons') continue;

    const entryPath = join(directory, name);
    if (!existsSync(entryPath)) continue;

    if (name === 'experimental') {
      for (const subName of readdirSync(entryPath).sort()) {
        if (subName.startsWith('_')) continue;
        const subPath = join(entryPath, subName);
        if (!existsSync(join(subPath, 'README.md'))) continue;
        results.push({ componentId: subName, directory: subPath });
      }
      continue;
    }

    if (!existsSync(join(entryPath, 'README.md'))) continue;
    results.push({ componentId: name, directory: entryPath });
  }
  return results;
}

/**
 * @param {string} rootDirectory absolute path to `packages/components/src/components`
 * @param {string} outputDirectory absolute path to write the generated `.svelte` files to
 * @returns {Promise<{ failures: Array<{ componentId: string; reason: 'no-heading' | 'no-fence' | 'no-matching-tag' }> }>}
 */
export async function main(
  rootDirectory = join(here, '..', '..', 'src', 'components'),
  outputDirectory = join(here, 'src', 'generated', 'readme-usage-examples'),
) {
  // Stale-file cleanup: this script only ever clears its own subdirectory,
  // never the sibling `probe.ts`/`Probe.svelte` output `generate-probe.mjs` owns.
  if (existsSync(outputDirectory)) rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });

  /** @type {Array<{ componentId: string; reason: 'no-heading' | 'no-fence' | 'no-matching-tag' }>} */
  const failures = [];

  for (const { componentId, directory } of discoverComponentDirectories(rootDirectory)) {
    if (COMPOSE_ONLY_LEAF_EXEMPTIONS.has(componentId)) continue;

    const readmeText = readFileSync(join(directory, 'README.md'), 'utf8');
    const extracted = extractUsageFence(readmeText);

    if ('error' in extracted) {
      failures.push({ componentId, reason: extracted.error });
      continue;
    }

    const pascalName = toIdentifier(componentId);
    if (
      !DOTTED_NAMESPACE_ONLY_EXEMPTIONS.has(componentId) &&
      !matchesComponentTag(extracted.code, pascalName)
    ) {
      failures.push({ componentId, reason: 'no-matching-tag' });
      continue;
    }

    // Still compile-check dotted-namespace-only fences (they are real,
    // rendering code) — the exemption only bypasses the literal-tag match,
    // not svelte-check.
    writeFileSync(join(outputDirectory, `${componentId}.svelte`), extracted.code);
  }

  return { failures };
}

if (import.meta.main) {
  const { failures } = await main();
  for (const failure of failures) {
    process.stderr.write(
      `generate-readme-usage-examples: ${failure.componentId}: ${failure.reason}\n`,
    );
  }
  if (failures.length > 0) process.exit(1);
}
