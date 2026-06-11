import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Glob } from 'bun';

/**
 * Aggregator-completeness gate for `src/styles/components.css`.
 *
 * The aggregate `/styles` (and `/styles/all`) bundle is a single CSS file that
 * `@import`s every component's CSS partial. Consumers who opt into the bundle —
 * rather than the per-component `@lostgradient/cinder/<name>` subpaths — get
 * styling for a component ONLY if that component's CSS is reachable from
 * `components.css` through the CSS `@import` chain.
 *
 * A component's own `index.ts` doing `import './<name>.css'` does NOT count:
 * aggregate consumers never execute that JS, so a component covered only by its
 * `index.ts` ships unstyled to the bundle. (This is the exact `DataTable` bug
 * that motivated the gate: data-table.css had its `index.ts` import but was
 * missing from `components.css`, so `/styles` consumers rendered it unstyled and
 * no existing check — build, typecheck, components:check, exports:check — caught
 * it.) Coverage is therefore defined strictly as reachability from
 * `components.css` over the CSS `@import` graph.
 */

/** A component CSS file that is intentionally NOT in the aggregate bundle. */
type AggregatorExclusion = {
  /** Path relative to `src/components`, e.g. `markdown-editor/prosemirror.css`. */
  readonly path: string;
  /** Why it is excluded — must justify why aggregate consumers don't need it. */
  readonly reason: string;
};

/**
 * Component CSS files deliberately excluded from the aggregate bundle. Every
 * entry needs a reason; the gate fails on any uncovered file NOT listed here, so
 * a new genuinely-missing import can't hide behind a silent category.
 */
export const AGGREGATOR_EXCLUSIONS: readonly AggregatorExclusion[] = [
  {
    path: 'markdown-editor/prosemirror.css',
    reason:
      'Third-party ProseMirror editor stylesheet, JS-imported directly by ' +
      'markdown-editor.svelte. It is intentionally out of the global bundle so ' +
      'apps not using the markdown editor do not pay for ProseMirror styling.',
  },
];

export type AggregatorViolation = {
  /** Component CSS path relative to `src/components`. */
  readonly path: string;
  readonly message: string;
};

/**
 * Compute the set of absolute file paths reachable from `entryFile` by
 * following `@import` statements (CSS chain only). The entry file itself is
 * included. Missing targets are skipped rather than thrown — a dangling
 * `@import` is a different defect, governed by the build.
 */
export function computeImportClosure(entryFile: string): Set<string> {
  const reachable = new Set<string>();
  const stack: string[] = [resolve(entryFile)];
  const importPattern = /@import\s+(?:url\()?['"]([^'"]+)['"]/g;

  while (stack.length > 0) {
    const file = stack.pop()!;
    if (reachable.has(file) || !existsSync(file)) continue;
    reachable.add(file);

    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      // Only relative specifiers participate in the on-disk import graph.
      // (The capture group is always present on a match, but narrow it
      // explicitly to satisfy noUncheckedIndexedAccess.)
      if (specifier !== undefined && specifier.startsWith('.')) {
        stack.push(resolve(dirname(file), specifier));
      }
    }
  }

  return reachable;
}

/**
 * Check that every component CSS partial under `componentsDirectory` is either
 * reachable from `aggregatorFile` through the CSS `@import` chain or listed in
 * `AGGREGATOR_EXCLUSIONS`. Returns one violation per uncovered, non-excluded
 * file. An empty array means the aggregate bundle is complete.
 */
export function checkAggregatorCompleteness(
  componentsDirectory: string,
  aggregatorFile: string,
): AggregatorViolation[] {
  const reachable = computeImportClosure(aggregatorFile);
  const excludedPaths = new Set(AGGREGATOR_EXCLUSIONS.map((exclusion) => exclusion.path));

  const componentCssGlob = new Glob('*/*.css');
  const componentCssFiles = [
    ...componentCssGlob.scanSync({ cwd: componentsDirectory, absolute: true }),
  ].toSorted();

  const violations: AggregatorViolation[] = [];
  for (const absolutePath of componentCssFiles) {
    if (reachable.has(absolutePath)) continue;
    const relativePath = relative(componentsDirectory, absolutePath);
    if (excludedPaths.has(relativePath)) continue;

    violations.push({
      path: relativePath,
      message:
        `${relativePath} is not reachable from styles/components.css through the ` +
        `CSS @import chain, so it ships UNSTYLED to /styles (aggregate) consumers. ` +
        `Add \`@import '../components/${relativePath}';\` to ` +
        `src/styles/components.css in alphabetical order — or, if it is ` +
        `intentionally excluded, add it to AGGREGATOR_EXCLUSIONS with a reason.`,
    });
  }

  return violations;
}

async function main(): Promise<void> {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const componentsSource = join(resolve(scriptDirectory, '..'), 'src');
  const componentsDirectory = join(componentsSource, 'components');
  const aggregatorFile = join(componentsSource, 'styles', 'components.css');

  const violations = checkAggregatorCompleteness(componentsDirectory, aggregatorFile);
  if (violations.length === 0) {
    process.stdout.write('aggregator:check — styles/components.css imports every component CSS.\n');
    process.exitCode = 0;
    return;
  }

  process.stderr.write(
    `aggregator:check — ${violations.length} component CSS partial(s) missing from styles/components.css:\n`,
  );
  for (const violation of violations) {
    process.stderr.write(`  ${violation.message}\n`);
  }
  process.exitCode = 1;
}

if (import.meta.main) {
  await main();
}
