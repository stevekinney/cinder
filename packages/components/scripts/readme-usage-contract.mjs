/**
 * The README `## Usage` fence contract, shared by the two gates that enforce it.
 *
 * Plain JavaScript (no TypeScript syntax) so it can be `import`ed both by
 * `check-readme-usage.ts` (run by Bun, in the PR lane) and by
 * `fixtures/typescript-consumer/generate-readme-usage-examples.mjs` (run by
 * plain `node` with no transpilation step, in `main-green` and the release
 * path). The exemption sets live here rather than in the fixture so the cheap
 * structural gate and the expensive compile gate can never disagree about who
 * is exempt — a drift that would let a component pass the PR lane and then
 * fail post-merge, which is exactly the failure this module exists to prevent.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Walks `src/components/` and returns every component directory that owns a
 * `README.md` — the set the `## Usage` contract applies to.
 *
 * Underscore-prefixed directories (`_radio`, `_internal`, …) and `icons/` are
 * private/internal and skipped, and `experimental/` is descended one level.
 * This deliberately keys on `README.md` presence rather than the
 * `<name>.svelte` + `<name>.types.ts` pair that
 * `scripts/discover-component-directories.ts` requires: the contract enforced
 * here is a property of READMEs, and a plain directory walk needs no tarball
 * install to be testable against a throwaway fixture root.
 *
 * @param {string} rootDirectory absolute path to `packages/components/src/components`
 * @returns {Array<{ componentId: string; directory: string }>}
 */
export function discoverReadmeComponents(rootDirectory) {
  const results = [];
  for (const name of readdirSync(rootDirectory).sort()) {
    if (name.startsWith('_')) continue;
    if (name === 'icons') continue;

    const entryPath = join(rootDirectory, name);
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
 * Convert a kebab-case component id to a TypeScript-safe PascalCase
 * identifier segment. Moved here from the typescript-consumer fixture so both
 * gates derive the expected tag name identically; the fixture's
 * `generate-probe.mjs` and `generate-readme-usage-examples.mjs` now import it
 * from this module.
 */
export function toIdentifier(id) {
  return id
    .split(/[-/]/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join('');
}

/**
 * Compose-only leaf components whose `## Usage` section is deliberately
 * prose-only ("compose-only leaf of `<Parent>`... see the parent README for
 * the composed snippet"), pointing readers at the parent compound
 * component's README instead of duplicating a working example. This is an
 * established, repo-wide documentation convention, not a bug — porting a
 * redundant standalone example into each of these would contradict the very
 * sentence the README teaches ("the idiomatic API is `Parent.Leaf`, reached
 * through the parent namespace").
 */
export const COMPOSE_ONLY_LEAF_EXEMPTIONS = new Set([
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
 * is deliberately literal and does not recognize `Parent.Leaf` as a match for
 * `Leaf`. Rewriting these to the flat tag purely to satisfy the gate would
 * teach the non-idiomatic composition this cluster's root cause explicitly
 * warns against; the dotted form is the correct, idiomatic usage for these
 * three.
 */
export const DOTTED_NAMESPACE_ONLY_EXEMPTIONS = new Set([
  'bento-cell',
  'grid-item',
  'speed-dial-action',
]);
