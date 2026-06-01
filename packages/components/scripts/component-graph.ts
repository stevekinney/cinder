/**
 * Dependency-aware test scoping: the import graph that powers it.
 *
 * Cinder has ~140 components, each in its own directory under
 * `src/components/<slug>/`, and they import each other via relative paths
 * (`import Button from '../button/button.svelte'`). When a single component
 * changes, CI should retest that component AND every component that
 * (transitively) depends on it — not the full matrix, and not just the one
 * file. This module builds the file-level import graph, inverts it to find
 * dependents, and maps the affected files back to component slugs.
 *
 * Design contract (intentionally conservative — a MISSED edge silently skips a
 * test, which is worse than a redundant full run):
 *
 *   - We model static imports, side-effect imports, `export … from` /
 *     `export * from` re-exports, and STRING-LITERAL dynamic `import('…')`.
 *   - A COMPUTED dynamic import (`import(variable)`) creates an edge the graph
 *     cannot see. Any such import outside a tiny known-safe harness allow-list
 *     forces the FULL suite, and {@link assertNoUnmodellableImports} keeps the
 *     allow-list honest so a newly-introduced computed import fails loudly
 *     instead of silently poisoning scoping forever.
 *   - The resolver mirrors the `moduleResolution: "bundler"` rules this repo
 *     uses (`.js` specifiers map to `.ts` on disk, extensionless specifiers
 *     probe `.ts`/`.svelte`/`index.*`). A specifier that resolves to TWO
 *     plausible on-disk files is AMBIGUOUS and forces full rather than guess.
 *
 * Pure and unit-testable: callers pass file contents in, so the same logic is
 * exercised in tests without touching the filesystem. The thin filesystem
 * wrappers ({@link loadSourceFiles}) live at the bottom.
 *
 * Mirrors the scanning idiom of `check-no-cycle-imports.ts` (Bun `Glob` over
 * `src/**`, regex extraction). Consumed by
 * `packages/testing/scripts/changed-components.ts`.
 */

import { Glob } from 'bun';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
/** Absolute path to `packages/components`. */
export const componentsPackageRoot = resolve(scriptDirectory, '..');
/** Absolute path to the repo root (`packages/components` → up two). */
export const workspaceRoot = resolve(componentsPackageRoot, '..', '..');

/**
 * Source roots scanned to build the graph. Components live in the first;
 * the sibling `@cinder/*` packages are included because a handful of
 * components import from `../../editor`, `../../markdown`, etc., and a change
 * in those packages must reach its component dependents.
 */
export const SCANNED_ROOTS: readonly string[] = [
  'packages/components/src',
  'packages/editor/src',
  'packages/markdown/src',
  'packages/diff/src',
  'packages/commentary/src',
];

/** Prefix (repo-relative, POSIX) under which component slugs are rooted. */
const COMPONENTS_PREFIX = 'packages/components/src/components/';

/**
 * Test files are EXCLUDED from the production import graph. A test's own
 * imports (and any computed `import()` it uses to exercise lazy-loading paths)
 * cannot create a component→component SOURCE edge — they are test machinery.
 * Including them would (a) flag legitimate test-only computed imports as
 * unmodellable, and (b) pollute the dependents closure with test-only edges.
 * What a changed component's tests ARE is decided by slug, not by graph edges.
 */
export function isTestFile(repoRelativePath: string): boolean {
  // Matches `*.test.ts`, `*.spec.ts`, `*.test.tsx`, and the rune-module
  // variants `*.svelte.test.ts` / `*.type-test.ts` used in this tree.
  return /\.(test|spec|type-test)\.(ts|tsx)$/.test(repoRelativePath);
}

/**
 * The ONLY known-safe computed dynamic imports. Both load a temp SSR module
 * written to disk at test time — they never create a component→component edge.
 * Keyed by repo-relative POSIX path.
 *
 * INVARIANT: every entry MUST be under `packages/components/src/test/`, which
 * itself force-fulls when changed (see {@link pathForceFullReason}). This keeps
 * the allow-list strictly test-harness-scoped: it exists only so the GLOBAL
 * unmodellable scan in {@link computeScope} does not force-full on every run for
 * these dormant harness imports — it can NEVER be used to wave through a
 * computed import in real component source (that still force-fulls). The
 * invariant is enforced by a unit test and by {@link assertNoUnmodellableImports}.
 */
export const UNMODELLABLE_IMPORT_ALLOWLIST: ReadonlySet<string> = new Set([
  'packages/components/src/test/hydrate.ts',
  'packages/components/src/test/server-render.ts',
]);

// ---------------------------------------------------------------------------
// Import extraction
// ---------------------------------------------------------------------------

/**
 * Matches `import … from '…'` and `export … from '…'` statements — including
 * the MULTILINE clause forms Prettier produces, which are the norm in this
 * codebase:
 *
 *   import X from '…'                 export { X } from '…'
 *   import { A, B } from '…'          export * from '…'
 *   import X, {                       export {
 *     type Y,                            a as b,
 *   } from '…'                         } from '…'
 *   import type { X } from '…'        export * as ns from '…'
 *
 * Strategy: anchor on a statement boundary (`^`, newline, `;`, `{`, `}`, or
 * `>` for inline Svelte `<script>` tags), require the `import`/`export`
 * keyword followed by whitespace, then consume the clause — which MAY span
 * newlines and contain braces (`[\s\S]`) — lazily up to the ` from ` keyword,
 * then capture the quoted specifier. The clause cannot contain a quote (so it
 * cannot swallow a later statement's specifier) and must contain ` from `
 * (so bare side-effect `import '…'` is handled by the dedicated pattern
 * below, and `import.meta` / `import(` never match — no ` from `).
 *
 * Group 2 is the specifier. False positives (e.g. an import inside a block
 * comment) only add redundant edges — harmless. False NEGATIVES are the
 * danger, so the pattern errs toward matching.
 */
const STATIC_IMPORT_PATTERN =
  /(?:^|[\n;{}>])\s*(?:import|export)\s[^'"]*?\sfrom\s*(['"])([^'"]+)\1/g;

/** Matches a side-effect `import '…';` (no clause), e.g. `import './styles.css';`. */
const SIDE_EFFECT_IMPORT_PATTERN = /(?:^|[\n;{}>])\s*import\s+(['"])([^'"]+)\1/g;

/**
 * Matches EVERY dynamic `import(` call, tolerating a comment between the
 * keyword and the paren (`import /* … *​/ (…)`). Group 1 is the raw argument
 * text up to the first `)`.
 */
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*(?:\/\*[\s\S]*?\*\/\s*)?\(\s*([^)]*?)\s*\)/g;

/** A string-literal dynamic-import argument: `import('…')`. */
const DYNAMIC_LITERAL_ARGUMENT = /^(['"])([^'"]+)\1$/;

/**
 * Detects a TS 5.5+ string-literal specifier NAME inside an import/export
 * clause — `import { "x" as y } from …` / `export { x as "y" } from …`. The
 * quote inside the clause defeats {@link STATIC_IMPORT_PATTERN}, so its
 * presence means an edge may have been dropped; callers treat the file as
 * unmodellable (force full) instead. Conservative — matches a braced clause
 * containing a quoted token followed by `from`.
 */
const STRING_LITERAL_SPECIFIER_NAME = /(?:import|export)\s*\{[^}]*['"][^}]*\}\s*from\s/;

export type ExtractedImports = {
  /** String-literal specifiers (static, side-effect, and literal dynamic). */
  readonly specifiers: string[];
  /**
   * True when the file contains a dynamic `import()` whose argument is NOT a
   * plain string literal — an edge the graph cannot model.
   */
  readonly hasUnmodellableImport: boolean;
};

/**
 * Extract every modellable import specifier from a source file, and flag any
 * unmodellable (computed) dynamic import.
 *
 * Svelte files are handled transparently: the patterns match `import`
 * statements wherever they appear, including inside `<script>` /
 * `<script module>` blocks, so no Svelte-specific preprocessing is needed.
 */
export function extractImports(content: string): ExtractedImports {
  const specifiers = new Set<string>();

  for (const pattern of [STATIC_IMPORT_PATTERN, SIDE_EFFECT_IMPORT_PATTERN]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const specifier = match[2];
      if (specifier !== undefined) specifiers.add(specifier);
    }
  }

  let hasUnmodellableImport = false;
  DYNAMIC_IMPORT_PATTERN.lastIndex = 0;
  let dynamicMatch: RegExpExecArray | null;
  while ((dynamicMatch = DYNAMIC_IMPORT_PATTERN.exec(content)) !== null) {
    const argument = dynamicMatch[1]?.trim() ?? '';
    // `import.meta`, `import type`, etc. never match `import(` — only real calls do.
    const literal = DYNAMIC_LITERAL_ARGUMENT.exec(argument);
    if (literal?.[2] !== undefined) {
      specifiers.add(literal[2]);
    } else if (argument.length > 0) {
      hasUnmodellableImport = true;
    }
  }

  // TS 5.5+ string-literal specifier NAMES inside an import clause
  // (`import { "x-y" as z } from '…'`) contain quotes the static pattern cannot
  // cross, so its specifier would be silently dropped. None exist in this tree
  // today; flag any as unmodellable (→ force full) so a future one fails safe
  // rather than silently dropping a graph edge.
  if (STRING_LITERAL_SPECIFIER_NAME.test(content)) {
    hasUnmodellableImport = true;
  }

  return { specifiers: [...specifiers], hasUnmodellableImport };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export type ResolveResult =
  | { kind: 'resolved'; path: string }
  | { kind: 'ambiguous'; candidates: readonly string[] }
  | { kind: 'external' };

/**
 * Candidate on-disk paths for a relative specifier, in priority order,
 * applying the repo's `moduleResolution: "bundler"` conventions:
 *
 *   - `.js` specifiers map to `.ts` on disk (TS rewrites the extension).
 *   - an explicit `.ts`/`.svelte`/`.json`/`.css`/`.tsx` extension resolves as-is.
 *   - an extensionless specifier probes `<base>.ts`, `<base>.tsx`,
 *     `<base>.svelte`, `<base>.svelte.ts`, then `<base>/index.{ts,tsx,svelte,svelte.ts}`.
 *
 * The `.js`/`.mjs`/`.cjs` → `.ts`/`.mts`/`.cts` rewrites mirror TypeScript's
 * `moduleResolution: "bundler"` extension substitution.
 *
 * Returns the candidates that actually EXIST (per `exists`). Zero → external
 * or missing; one → resolved; two or more → ambiguous.
 */
export function resolveCandidates(absoluteBase: string): string[] {
  const candidates: string[] = [];
  const ext = extensionOf(absoluteBase);

  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    // `./x.js` → `./x.ts`, `./x.mjs` → `./x.mts`, `./x.cjs` → `./x.cts` (TS
    // source convention). Keep the original too in case a real JS file ships.
    const withoutExt = absoluteBase.slice(0, -ext.length);
    const tsCounterpart = ext === '.mjs' ? '.mts' : ext === '.cjs' ? '.cts' : '.ts';
    candidates.push(`${withoutExt}${tsCounterpart}`, `${withoutExt}.ts`, absoluteBase);
  } else if (ext !== '') {
    candidates.push(absoluteBase);
  } else {
    candidates.push(
      `${absoluteBase}.ts`,
      `${absoluteBase}.tsx`,
      `${absoluteBase}.svelte`,
      `${absoluteBase}.svelte.ts`,
      join(absoluteBase, 'index.ts'),
      join(absoluteBase, 'index.tsx'),
      join(absoluteBase, 'index.svelte'),
      join(absoluteBase, 'index.svelte.ts'),
    );
  }

  return candidates;
}

/** Compound extensions checked before the generic single-dot fallback. */
const COMPOUND_EXTENSIONS = ['.svelte.ts', '.svelte.tsx'] as const;

function extensionOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  // `button.svelte.ts` must report `.svelte.ts`, not `.ts` — otherwise an
  // explicit `./button.svelte.ts` specifier would skip the extensionless probe
  // that generates the `.svelte.ts` candidate.
  for (const compound of COMPOUND_EXTENSIONS) {
    if (base.endsWith(compound)) return compound;
  }
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot);
}

/**
 * Resolve a single import specifier against the importing file.
 *
 * @param fromFile - repo-relative POSIX path of the importing file.
 * @param specifier - the import specifier as written.
 * @param exists - predicate over repo-relative POSIX paths (injected so the
 *   resolver is pure/testable; the filesystem wrapper supplies the real one).
 *
 * Bare specifiers (`zod`, `@cinder/markdown`, `svelte`) are `external` — they
 * cannot change inside a component-source diff, so they create no edge.
 * Relative specifiers resolve to exactly one file, or `ambiguous` when two
 * plausible on-disk targets exist (e.g. both `x.svelte` and `x.svelte.ts`).
 */
export function resolveImport(
  fromFile: string,
  specifier: string,
  exists: (repoRelativePath: string) => boolean,
): ResolveResult {
  if (!specifier.startsWith('.')) {
    return { kind: 'external' };
  }

  const fromDirectory = dirname(fromFile);
  const absoluteBase = join(fromDirectory, specifier);
  const candidates = resolveCandidates(absoluteBase).map(normalizeRepoPath);
  // Dedupe AFTER normalization: distinct candidate strings can normalize to the
  // same path (e.g. the `.js`→`.ts` rewrite and the literal `.ts` probe), and a
  // duplicate that exists would otherwise be miscounted as a 2-candidate ambiguity.
  const present = [...new Set(candidates)].filter((candidate) => exists(candidate));

  if (present.length === 0) return { kind: 'external' };
  if (present.length === 1) return { kind: 'resolved', path: present[0]! };
  return { kind: 'ambiguous', candidates: present };
}

/** Normalize a joined path to a clean repo-relative POSIX path. */
function normalizeRepoPath(path: string): string {
  return path.split('\\').join('/');
}

// ---------------------------------------------------------------------------
// Slug mapping
// ---------------------------------------------------------------------------

/**
 * The component slug a file belongs to: the directory directly under
 * `src/components/`. Files in nested subdirectories (`chat/input/…`) map to
 * the top-level slug (`chat`). Files outside the components tree (utilities,
 * `_internal`, sibling packages) return `null` — they are shared, not a slug.
 */
export function slugForFile(repoRelativePath: string): string | null {
  if (!repoRelativePath.startsWith(COMPONENTS_PREFIX)) return null;
  const rest = repoRelativePath.slice(COMPONENTS_PREFIX.length);
  const firstSegment = rest.split('/')[0] ?? '';
  // `_internal`, `_sortable-item.svelte`, bare files like `chart.types.ts` at
  // the components root are not component slugs.
  if (firstSegment === '' || firstSegment.startsWith('_')) return null;
  if (!rest.includes('/')) return null; // a bare file directly in components/
  // `experimental/<name>/index.ts` is a generated DEPRECATION-ALIAS shim that
  // re-exports the promoted top-level component (`../../<name>`). It has no
  // `.svelte` and no test suite of its own; its only graph role is the edge to
  // the real component, which is already mapped to that component's slug. So it
  // is not itself a slug — treat the alias container like `_internal`.
  if (firstSegment === 'experimental') return null;
  return firstSegment;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export type ImportGraph = {
  /** file → set of files it imports (forward edges). */
  readonly forward: Map<string, Set<string>>;
  /** file → set of files that import it (reverse edges / dependents). */
  readonly reverse: Map<string, Set<string>>;
  /** files whose imports could not be fully modelled (computed dynamic import). */
  readonly unmodellableFiles: Set<string>;
  /** files containing an ambiguous import the resolver refused to guess. */
  readonly ambiguousFiles: Set<string>;
};

/**
 * Build the import graph from a map of repo-relative POSIX path → file
 * contents. `exists` defaults to "is a key in the map", which is correct when
 * the map contains the full scanned source set.
 */
export function buildImportGraph(
  files: ReadonlyMap<string, string>,
  exists: (repoRelativePath: string) => boolean = (path) => files.has(path),
): ImportGraph {
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();
  const unmodellableFiles = new Set<string>();
  const ambiguousFiles = new Set<string>();

  for (const [file, content] of files) {
    const { specifiers, hasUnmodellableImport } = extractImports(content);
    if (hasUnmodellableImport) unmodellableFiles.add(file);

    const edges = forward.get(file) ?? new Set<string>();
    forward.set(file, edges);

    for (const specifier of specifiers) {
      const result = resolveImport(file, specifier, exists);
      if (result.kind === 'resolved') {
        edges.add(result.path);
        const back = reverse.get(result.path) ?? new Set<string>();
        back.add(file);
        reverse.set(result.path, back);
      } else if (result.kind === 'ambiguous') {
        // Record the file as ambiguous. We do NOT synthesize reverse edges for
        // the candidates: any ambiguous import in the scanned graph forces a
        // full run globally (see computeScope step 3), so the closure never
        // needs to "reach" this file. Keeping the graph free of speculative
        // edges keeps it an honest model of the real imports.
        ambiguousFiles.add(file);
      }
    }
  }

  return { forward, reverse, unmodellableFiles, ambiguousFiles };
}

/**
 * Every file reachable by following reverse (dependent) edges from the seed
 * set, INCLUDING the seeds. BFS with a visited set, so the known import cycles
 * in the tree terminate cleanly.
 */
export function dependentsClosure(graph: ImportGraph, changedFiles: Iterable<string>): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [];

  for (const file of changedFiles) {
    if (!visited.has(file)) {
      visited.add(file);
      queue.push(file);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = graph.reverse.get(current);
    if (dependents === undefined) continue;
    for (const dependent of dependents) {
      if (!visited.has(dependent)) {
        visited.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return visited;
}

// ---------------------------------------------------------------------------
// Force-full classification
// ---------------------------------------------------------------------------

/**
 * Path-only force-full rules: a changed file matching any of these can affect
 * every component's bundle or the whole test harness, so it forces the full
 * suite. Pure function of the path string — no disk or content access.
 *
 * Returns a human-readable reason, or `null` when the path is not a path-based
 * force-full trigger (it may still force full for content/diff reasons).
 */
export function pathForceFullReason(repoRelativePath: string): string | null {
  const path = normalizeRepoPath(repoRelativePath);

  // The testing package: fixtures, Playwright config, helpers, AND the scope
  // script itself all affect how/which tests run. Force full on any change here
  // except documentation. A change to the scope script forcing full is the safe
  // default — a scoper bug must not be able to under-test the very PR that
  // introduced it.
  if (path.startsWith('packages/testing/')) {
    // Markdown in the testing package (README, auto-generated CHANGELOG) cannot
    // affect test behavior.
    if (/\.(md|mdx)$/.test(path)) return null;
    return `testing-harness change: ${path}`;
  }

  // The components package's SHARED test harness (`src/test/**`: lifecycle
  // helpers, render/hydrate utilities) is imported by component tests but is
  // excluded from the import graph, so it has no reverse edges to map. A change
  // there can affect EVERY component test, so force full rather than let it be
  // silently dropped when co-changed with a single component.
  if (path.startsWith('packages/components/src/test/')) {
    return `shared test-harness change: ${path}`;
  }

  // Lockfile / runtime config / TS config: can change resolution for everything.
  if (path === 'bun.lock' || path === 'bun.lockb') return 'lockfile change';
  if (path === 'bunfig.toml') return 'bun config change';
  if (path === '.npmrc') return 'npm config change';
  if (/(^|\/)tsconfig[^/]*\.json$/.test(path)) return `tsconfig change: ${path}`;

  // Any package manifest (root or per-package) can change a dependency version,
  // exports map, or script — all of which can affect every component.
  if (path === 'package.json') return 'root manifest change';
  if (/^packages\/[^/]+\/package\.json$/.test(path)) return `package manifest change: ${path}`;

  // Build / generate / manifest / scope scripts shape every component's
  // artifacts or the test scoping itself. Any change under a package's
  // `scripts/` forces full — including the scope scripts, so a scoper bug
  // cannot under-test the PR that introduced it.
  if (/^packages\/[^/]+\/scripts\//.test(path)) {
    return `build/generate script change: ${path}`;
  }

  // Global styles / design tokens affect every component visually.
  if (path.startsWith('packages/components/src/styles/')) {
    return `global styles change: ${path}`;
  }

  // CI workflow changes force full: a workflow edit can alter which tests run,
  // the environment, or how the scoper is invoked. No exceptions — including the
  // browser-tests workflow itself, whose `scope` job drives the very selection
  // this scoper feeds.
  if (path.startsWith('.github/workflows/')) {
    return `workflow change: ${path}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Scope decision
// ---------------------------------------------------------------------------

export type ScopeDecision =
  | { mode: 'full'; reason: string }
  | { mode: 'filtered'; slugs: readonly string[] };

export type ComputeScopeOptions = {
  /** Repo-relative POSIX paths of files the diff touched. */
  readonly changedFiles: readonly string[];
  /** Repo-relative POSIX paths of CHANGED files that no longer exist on disk (deletions/renames). */
  readonly deletedFiles?: readonly string[];
  /** The full scanned source set (path → contents) used to build the graph. */
  readonly sourceFiles: ReadonlyMap<string, string>;
  /** Known component slugs (directories with a `<slug>.svelte`). */
  readonly knownSlugs: ReadonlySet<string>;
};

/**
 * The core decision. Composes the three force-full classifiers (path, diff
 * status, content/import) with the dependents-closure mapping.
 *
 * Force-full when ANY of:
 *   - a changed path matches {@link pathForceFullReason};
 *   - a changed file was DELETED (we do not reconstruct the base-state graph,
 *     so we cannot know who depended on it — force full);
 *   - a NON-allow-listed computed dynamic import exists anywhere in the scanned
 *     source (it is an edge the graph cannot see — globally unsafe);
 *   - a changed file (or a file on a closure path) has an AMBIGUOUS import;
 *   - a changed source file maps to NO component slug and is not a known shared
 *     module the graph could trace to slugs.
 *
 * Otherwise filtered: the dependents closure of the changed component-source
 * files, mapped to slugs.
 */
export function computeScope(options: ComputeScopeOptions): ScopeDecision {
  const { changedFiles, deletedFiles = [], sourceFiles, knownSlugs } = options;

  // 1. Path-based force-full.
  for (const path of changedFiles) {
    const reason = pathForceFullReason(path);
    if (reason !== null) return { mode: 'full', reason };
  }

  // 2. Deletions / renames force full.
  if (deletedFiles.length > 0) {
    return {
      mode: 'full',
      reason: `deleted/renamed file(s): ${[...deletedFiles].toSorted().join(', ')}`,
    };
  }

  // 3. Globally-unsafe edges force full, regardless of what changed. Both
  //    represent edges the graph could not model, so ANY closure built from
  //    this graph might be incomplete — the only safe response is full.
  //    Handling them globally (rather than only when reached in the closure)
  //    also lets us avoid synthesizing speculative reverse edges for ambiguous
  //    imports: we never need the closure to "reach" them.
  const graph = buildImportGraph(sourceFiles);
  const offendingUnmodellable = [...graph.unmodellableFiles].filter(
    (file) => !UNMODELLABLE_IMPORT_ALLOWLIST.has(file),
  );
  if (offendingUnmodellable.length > 0) {
    return {
      mode: 'full',
      reason: `computed dynamic import (unmodellable edge) in: ${offendingUnmodellable.toSorted().join(', ')}`,
    };
  }
  if (graph.ambiguousFiles.size > 0) {
    return {
      mode: 'full',
      reason: `ambiguous import (unresolvable edge) in: ${[...graph.ambiguousFiles].toSorted().join(', ')}`,
    };
  }

  // Classify every changed file. A file is accounted for if it is one of:
  //   - a graph source file (in `sourceFiles`) → seeds the dependents closure;
  //   - a component-tree file with a slug (e.g. a `*.test.ts`, `*.css`, or
  //     other sidecar NOT in the graph) → contributes its slug directly, so a
  //     co-changed test file is never dropped just because the graph excludes it;
  //   - a traceable shared module → seeds the closure (its dependents resolve
  //     to slugs) even if it is not itself a slug.
  // ANYTHING ELSE that reaches here (a changed file not in the graph, not a
  // component-tree file, not a known force-full path, not an example — examples
  // are handled by the caller) is UNACCOUNTED FOR and forces full. This closes
  // the silent-miss hole where a non-source change (bunfig.toml, a sibling
  // package.json, a stray asset) co-changed with a component would be ignored
  // because the component's slug "won".
  const closureSeeds: string[] = [];
  const directSlugs = new Set<string>();
  for (const file of changedFiles) {
    if (isIgnorableFile(file)) continue; // docs/markdown/etc. cannot affect tests
    if (sourceFiles.has(file)) {
      closureSeeds.push(file);
      continue;
    }
    const slug = slugForFile(file);
    if (slug !== null) {
      // A component-tree file (e.g. test/CSS sidecar) not in the graph.
      directSlugs.add(slug);
      continue;
    }
    if (isTraceableSharedModule(file)) {
      closureSeeds.push(file);
      continue;
    }
    return { mode: 'full', reason: `unaccounted changed file: ${file}` };
  }

  // 4. Dependents closure → slugs. (Ambiguity is already handled globally in
  //    step 3, so the closure here is built from a fully-modelled graph.)
  const closure = dependentsClosure(graph, closureSeeds);

  const slugs = new Set<string>(directSlugs);
  for (const file of closure) {
    const slug = slugForFile(file);
    if (slug !== null) slugs.add(slug);
  }

  // Every slug must be a real, known component; an unknown slug means the
  // closure (or a direct component-tree change) reached something the manifest
  // does not know → fail safe to full.
  const unknown = [...slugs].filter((slug) => !knownSlugs.has(slug));
  if (unknown.length > 0) {
    return {
      mode: 'full',
      reason: `closure reached unknown slug(s): ${unknown.toSorted().join(', ')}`,
    };
  }

  if (slugs.size === 0) {
    return { mode: 'full', reason: 'no component-mapped changes detected' };
  }

  return { mode: 'filtered', slugs: [...slugs].toSorted() };
}

/**
 * Files that genuinely cannot affect any test outcome: documentation, license,
 * changelogs, and editor/VCS dotfiles. These contribute no scope and — unlike
 * an unrecognized source/config file — must NOT force full. Kept narrow:
 * anything that could plausibly change a test (config, lockfiles, scripts) is
 * deliberately excluded so it falls through to the force-full path.
 *
 * Markdown is ignorable ANYWHERE (it cannot change runtime behavior). The
 * LICENSE/CHANGELOG/dotfile basenames are ignored ONLY outside the component
 * source tree: a position-insensitive basename match could otherwise swallow a
 * (hypothetical) test-relevant `components/<slug>/LICENSE`, a silent miss. Any
 * such file inside `src/components/**` instead force-fulls via the unaccounted
 * path — safe and loud.
 */
function isIgnorableFile(repoRelativePath: string): boolean {
  const path = normalizeRepoPath(repoRelativePath);
  if (/\.(md|mdx|markdown)$/i.test(path)) return true;
  if (path.startsWith('packages/components/src/')) return false;
  const base = path.slice(path.lastIndexOf('/') + 1);
  const IGNORABLE_BASENAMES = new Set([
    'LICENSE',
    '.gitignore',
    '.gitattributes',
    '.editorconfig',
    '.prettierignore',
  ]);
  return IGNORABLE_BASENAMES.has(base);
}

/**
 * Shared modules whose changes ARE traceable to component slugs via the graph
 * (so they should not force full just for lacking a slug). These are the
 * non-component source areas components import from.
 */
function isTraceableSharedModule(repoRelativePath: string): boolean {
  const path = normalizeRepoPath(repoRelativePath);
  return (
    path.startsWith('packages/components/src/utilities/') ||
    path.startsWith('packages/components/src/_internal/') ||
    path.startsWith('packages/components/src/schemas/') ||
    path.startsWith('packages/components/src/highlighters/') ||
    path === 'packages/components/src/schema-types.ts' ||
    path.startsWith('packages/editor/src/') ||
    path.startsWith('packages/markdown/src/') ||
    path.startsWith('packages/diff/src/') ||
    path.startsWith('packages/commentary/src/')
  );
}

// ---------------------------------------------------------------------------
// Filesystem wrappers (thin; the logic above is pure)
// ---------------------------------------------------------------------------

/**
 * Read every scannable source file under {@link SCANNED_ROOTS} into a map of
 * repo-relative POSIX path → contents. Excludes the test harness's own
 * compiled output and node_modules (the globs are scoped to `src`).
 */
export async function loadSourceFiles(): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const glob = new Glob('**/*.{ts,tsx,svelte,mts,cts,js,mjs,cjs}');

  for (const root of SCANNED_ROOTS) {
    const absoluteRoot = join(workspaceRoot, root);
    for await (const relativePath of glob.scan({ cwd: absoluteRoot })) {
      const absolute = join(absoluteRoot, relativePath);
      const repoRelative = normalizeRepoPath(relative(workspaceRoot, absolute));
      // Test files are not part of the production graph (see isTestFile).
      if (isTestFile(repoRelative)) continue;
      files.set(repoRelative, await Bun.file(absolute).text());
    }
  }

  return files;
}

/**
 * Discover known component slugs by reading the components source directory:
 * a slug is a directory directly under `src/components/` that contains a
 * `<slug>.svelte`. Mirrors the playground's own discovery and the legacy
 * `loadKnownSlugs` this graph replaces.
 */
export async function loadKnownSlugs(): Promise<Set<string>> {
  const { readdir } = await import('node:fs/promises');
  const componentsDirectory = join(workspaceRoot, COMPONENTS_PREFIX);
  const entries = await readdir(componentsDirectory, { withFileTypes: true });
  const slugs = new Set<string>();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;
    const svelte = join(componentsDirectory, entry.name, `${entry.name}.svelte`);
    if (await Bun.file(svelte).exists()) slugs.add(entry.name);
  }
  return slugs;
}

/**
 * Guard used by the test suite: assert that the ONLY computed dynamic imports
 * in scanned source are the known-safe harness sites. If this throws, a new
 * computed `import()` was introduced and the author must either refactor it to
 * a string literal or add it to {@link UNMODELLABLE_IMPORT_ALLOWLIST} with a
 * justification — otherwise scoping silently degrades to always-full.
 */
export function assertNoUnmodellableImports(files: ReadonlyMap<string, string>): void {
  const offenders: string[] = [];
  for (const [file, content] of files) {
    if (isTestFile(file)) continue; // test-only computed imports are not graph edges
    if (extractImports(content).hasUnmodellableImport && !UNMODELLABLE_IMPORT_ALLOWLIST.has(file)) {
      offenders.push(file);
    }
  }
  if (offenders.length > 0) {
    throw new Error(
      `Unmodellable computed dynamic import(s) found outside the allow-list:\n` +
        offenders
          .toSorted()
          .map((file) => `  • ${file}`)
          .join('\n') +
        `\n\nThese create import edges the dependency-aware test scoper cannot see, so a change ` +
        `to the imported module would silently skip the dependent's tests.\n` +
        `Fix by refactoring to a string-literal import, or — if the import genuinely cannot ` +
        `create a component→component edge — add the file to UNMODELLABLE_IMPORT_ALLOWLIST in ` +
        `component-graph.ts with a comment explaining why.`,
    );
  }
}
