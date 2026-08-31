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

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractUsageFence,
  matchesComponentTag,
} from '../../scripts/extract-readme-usage-example.mjs';
import {
  COMPOSE_ONLY_LEAF_EXEMPTIONS,
  DOTTED_NAMESPACE_ONLY_EXEMPTIONS,
  discoverReadmeComponents,
  toIdentifier,
} from '../../scripts/readme-usage-contract.mjs';

const here = dirname(fileURLToPath(import.meta.url));

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

  for (const { componentId, directory } of discoverReadmeComponents(rootDirectory)) {
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
