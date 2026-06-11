import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Glob } from 'bun';
import { parse, type Root } from 'postcss';

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
 * Extract the relative specifier from a postcss `@import` at-rule's params, or
 * `undefined` if the import isn't a relative on-disk reference we should chase.
 *
 * postcss hands us the raw params after `@import ` — every valid CSS form:
 *   `'./x.css'`  `"../x.css"`  `url(./x.css)`  `url('../x.css')`  `url("./x.css")`
 * each optionally trailed by `layer(...)`, `supports(...)`, or a media query.
 * We unwrap an optional `url(...)`, strip surrounding quotes, then keep only
 * the first whitespace-delimited token (dropping any trailing layer/media), and
 * accept it only if it's a relative path (`.`-prefixed). Bare/aliased/absolute
 * specifiers don't resolve to a local component file on disk, so they're not
 * part of the on-disk closure and are simply ignored (cinder's aggregate
 * stylesheet uses only relative imports).
 */
function extractRelativeImportSpecifier(params: string): string | undefined {
  let raw = params.trim();

  const urlMatch = /^url\(\s*(.*?)\s*\)/i.exec(raw);
  if (urlMatch?.[1] !== undefined) {
    raw = urlMatch[1].trim();
  } else {
    // Non-url form: the specifier is the first token; drop trailing
    // layer()/supports()/media-query clauses.
    raw = raw.split(/\s+/)[0] ?? '';
  }

  // Strip a single pair of surrounding quotes, if present.
  const quoted = /^(['"])(.*)\1$/.exec(raw);
  if (quoted?.[2] !== undefined) {
    raw = quoted[2];
  }

  return raw.startsWith('.') ? raw : undefined;
}

/**
 * Collect the relative specifiers of the **honored** top-level `@import` rules
 * of one parsed stylesheet, in source order.
 *
 * Matches CSS semantics, not a naive tree walk: a `@import` is honored by the
 * browser/bundler only at the top level (NOT nested inside `@media`/`@supports`)
 * and only in the stylesheet prelude — before any style rule. Per the spec the
 * prelude may also contain a leading `@charset` and `@layer` statements; once a
 * style rule or any other at-rule appears, later `@import`s are ignored. We
 * mirror that: walk only `root.nodes` (top level), stop honoring `@import` after
 * the prelude ends. This is what prevents a nested or late `@import` from being
 * falsely counted as coverage when the real bundle would drop it.
 */
function honoredImportSpecifiers(root: Root): string[] {
  const specifiers: string[] = [];
  for (const node of root.nodes) {
    if (node.type === 'comment') continue;
    if (node.type === 'atrule') {
      if (node.name === 'import') {
        const specifier = extractRelativeImportSpecifier(node.params);
        if (specifier !== undefined) specifiers.push(specifier);
        continue;
      }
      // `@charset` and the statement form of `@layer` (no block) may legally
      // precede imports without ending the prelude.
      if (node.name === 'charset') continue;
      if (node.name === 'layer' && node.nodes === undefined) continue;
    }
    // Any style rule, declaration, or other at-rule (incl. @media/@supports
    // and a block-form @layer) ends the import prelude — stop honoring imports.
    break;
  }
  return specifiers;
}

/**
 * Compute the set of absolute file paths reachable from `entryFile` by
 * following the **honored** CSS `@import` chain (see {@link honoredImportSpecifiers}).
 * The entry file itself is included. Missing targets are skipped rather than
 * thrown — a dangling `@import` is a different defect, governed by the build.
 *
 * Uses a real CSS parser (postcss) rather than a regex so that commented-out
 * imports (`/* @import '…'; *\/`) are NOT counted as coverage — a regex would
 * treat them as real and let an unstyled component pass the gate. postcss parses
 * them as `comment` nodes, never `atrule` nodes, so they're correctly ignored.
 * Both quoted and `url(...)` import forms are handled via
 * {@link extractRelativeImportSpecifier}.
 */
export function computeImportClosure(entryFile: string): Set<string> {
  const reachable = new Set<string>();
  const stack: string[] = [resolve(entryFile)];

  while (stack.length > 0) {
    const file = stack.pop();
    if (file === undefined || reachable.has(file) || !existsSync(file)) continue;
    reachable.add(file);

    const root = parse(readFileSync(file, 'utf8'), { from: file });
    for (const specifier of honoredImportSpecifiers(root)) {
      stack.push(resolve(dirname(file), specifier));
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

  // `**/*.css` (not `*/*.css`) so a deeper partial like
  // `<component>/internal/<name>.css` can't ship unstyled by hiding below the
  // first directory level.
  const componentCssGlob = new Glob('**/*.css');
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

function main(): void {
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
  main();
}
