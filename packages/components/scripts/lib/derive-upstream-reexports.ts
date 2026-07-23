/**
 * Derives `@lostgradient/cinder/<pkg>/<subpath>` re-exports from the public `exports` map of
 * each upstream workspace package (`markdown`, `editor`).
 *
 * The workspace packages stay on disk as source-only inputs. Their
 * public sub-paths are mechanically mirrored into `@lostgradient/cinder`'s exports map as
 * `./<pkg>/<subpath>` entries, and a thin re-export file is generated under
 * `packages/components/src/<pkg>/<subpath>.ts`. The cinder build bundles
 * those re-export entrypoints into `dist/` so the published `@lostgradient/cinder` package
 * has zero runtime dependency on either upstream package.
 *
 * Acceptance criterion: every public sub-path in each upstream
 * `package.json#exports` appears in cinder's exports map, EXCEPT the
 * `CINDER_KEY_OVERRIDES` entries below. CI fails on drift (see
 * `generate-exports.ts`'s check mode).
 *
 * ## The former `@cinder/editor` subpaths
 *
 * `@cinder/editor` was dissolved (see `docs/decisions/package-boundaries.md`,
 * Phase 1): its headless placeholder trio moved into `@lostgradient/markdown`'s
 * `templates/` directory, and its ProseMirror/Milkdown half moved into
 * `@lostgradient/editor`'s `editor/` directory. Cinder's published surface is
 * frozen for this move — every `./editor/*` cinder subpath must keep
 * resolving to the same symbol set it always did — so the six former
 * `@cinder/editor` subpaths are preserved via `CINDER_KEY_OVERRIDES`,
 * remapping specific markdown/editor subpaths back onto `./editor/*`
 * cinder keys instead of their natural `./markdown/*` / `./editor/editor/*`
 * mirror. Two markdown subpaths (`./templates/placeholder-security`,
 * `./templates/types`) exist only to let editor's composite
 * `editor/index.ts` re-compose the old barrel from both packages — they are
 * real `@lostgradient/markdown` surface but have no old-cinder equivalent, so they
 * are suppressed (mapped to `null`) rather than mirrored as new cinder keys.
 *
 * ## The former `@cinder/diff` package
 *
 * `@cinder/diff` (see `docs/decisions/package-boundaries.md`, Phase 2) folded
 * into `@lostgradient/markdown/diff` — it was three files and sixteen lines of shim
 * surface that existed principally to serve `@cinder/markdown`. Its old
 * top-level cinder mirror (`./diff`, `./diff/line-diff`, `./diff/types`) is
 * gone along with it: the real, in-repo-used surface was always
 * `./markdown/diff/line-diff` (every component that consumes line-diff — the
 * diff viewer and review editor — already imported that path, never the
 * top-level alias), so nothing loses functionality, only a redundant alias.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

/** Root of the cinder repository (workspace root). */
const WORKSPACE_ROOT = join(scriptDirectory, '..', '..', '..', '..');

/** Root of the `@lostgradient/cinder` (`packages/components`) package. */
const COMPONENTS_PACKAGE_ROOT = join(scriptDirectory, '..', '..');

/**
 * The workspace packages whose public exports flow through
 * `@lostgradient/cinder/<pkg>/*`. Order is significant only for deterministic output.
 */
export const UPSTREAM_PACKAGES = ['markdown', 'editor'] as const;

export type UpstreamPackageName = (typeof UPSTREAM_PACKAGES)[number];

/**
 * `editor` builds via `svelte-package` (it ships Svelte components alongside
 * its headless runtime), which requires the packaged surface to live under a
 * `src/lib/` root. `markdown` builds via plain `tsc` and keeps its source
 * directly under `src/`. Both conventions are load-bearing for their own
 * package's build, so the upstream-reexport resolver has to know which root
 * each upstream package actually uses instead of assuming `src/` uniformly.
 */
function upstreamSourceRoot(pkg: UpstreamPackageName): string {
  return pkg === 'editor' ? join('src', 'lib') : 'src';
}

/**
 * The actual npm package name for each upstream package. `markdown` is
 * published as `@lostgradient/markdown` (see `docs/decisions/package-boundaries.md`,
 * Phase 2); `editor` is still workspace-private under the `@cinder/*`
 * scope pending Phase 3.
 */
export const UPSTREAM_PACKAGE_NAMES: Record<UpstreamPackageName, string> = {
  markdown: '@lostgradient/markdown',
  editor: '@lostgradient/editor',
};

/**
 * Overrides the mechanically-derived cinder key for specific upstream
 * subpaths, keyed by `${pkg}:${upstreamSubpath}`.
 *
 *   - A string value replaces the default `./<pkg>/<subpath>` cinder key
 *     (and the generated shim's location under `packages/components/src/`)
 *     with the given key instead. Used to keep the six former
 *     `@cinder/editor` subpaths at `./editor/*` after the packages that now
 *     own their source (`@cinder/markdown`, `@lostgradient/editor`) changed.
 *   - `null` suppresses the subpath entirely from cinder's mirror — it stays
 *     real, resolvable `@cinder/*` surface, just not re-exported through
 *     `@lostgradient/cinder`. Used for markdown subpaths that exist purely so
 *     `@lostgradient/editor` can import them (they have no old-cinder
 *     equivalent, so mirroring them would grow cinder's published surface).
 */
export const CINDER_KEY_OVERRIDES: ReadonlyMap<string, string | null> = new Map([
  ['markdown:./templates/sanitize-html', './editor/sanitize-html'],
  ['markdown:./templates/template-placeholders', './editor/template-placeholders'],
  ['markdown:./templates/template-render', './editor/template-render'],
  ['markdown:./templates/placeholder-security', null],
  ['markdown:./templates/types', null],
  // `editor`'s own top-level barrel would naturally mirror to `./editor`
  // (the formula is `./${pkg}`) — but that collides with the intentional
  // override two lines down, which points cinder's `./editor` key at
  // `editor`'s NESTED `./editor` subpath (the ProseMirror runtime, preserved
  // at its old `@cinder/editor`-era cinder key). Editor's root barrel is the
  // SAME aggregate surface `@cinder/commentary`'s root barrel used to be
  // (anchor-decorations + anchoring + comments + export + session +
  // shared/anchor-types, all re-exported together) — a live, published
  // `@lostgradient/cinder/commentary` key with real external consumers, so it is
  // remapped to that old key instead of being dropped or given the
  // colliding `./editor` key.
  ['editor:.', './commentary'],
  ['editor:./editor', './editor'],
  ['editor:./editor/component-runtime', './editor/component-runtime'],
  ['editor:./editor/test-utilities', './editor/test-utilities'],
  // `editor`'s headless anchor/comment/session/export runtime — the ProseMirror
  // decoration plugin, comment-thread model, session persistence, and
  // LLM/diff export helpers — is the renamed `@cinder/commentary` package
  // (Phase 3 of package-boundaries.md). Cinder's published surface is frozen
  // for this move too: every `./commentary/*` cinder subpath these covered
  // must keep resolving, at its OLD `@cinder/commentary`-era cinder key, not
  // the natural `./editor/<subpath>` mirror the default formula would
  // produce (that formula is what the six `./editor/*` overrides above exist
  // to correct for the ProseMirror half; this block does the same job for
  // the commentary half).
  ['editor:./anchor-decorations', './commentary/anchor-decorations'],
  ['editor:./anchoring', './commentary/anchoring'],
  ['editor:./comments', './commentary/comments'],
  ['editor:./comments/types', './commentary/comments/types'],
  ['editor:./export', './commentary/export'],
  ['editor:./export/types', './commentary/export/types'],
  ['editor:./session', './commentary/session'],
  ['editor:./session/types', './commentary/session/types'],
  ['editor:./shared/anchor-types', './commentary/shared/anchor-types'],
  // `editor`'s manifest and Svelte-component subpaths (Phase 3 of
  // package-boundaries.md: `markdown-editor`, `review-editor`, `diff-viewer`)
  // are real `@lostgradient/editor` surface but are never mirrored into cinder.
  // Unlike the headless runtime above, cinder has no re-export machinery for
  // compiled `.svelte` components (`generate-exports.ts`'s component pipeline
  // only understands components that physically live under
  // `packages/components/src/components/`) — see the Phase 3 PR description
  // for why a hand-authored shim was rejected in favor of dropping these
  // subpaths from cinder's published surface entirely.
  ['editor:./manifest', null],
  ['editor:./markdown-editor', null],
  ['editor:./markdown-editor/schema', null],
  ['editor:./markdown-editor/variables', null],
  ['editor:./markdown-editor/styles', null],
  ['editor:./markdown-editor/examples', null],
  ['editor:./review-editor', null],
  ['editor:./review-editor/schema', null],
  ['editor:./review-editor/variables', null],
  ['editor:./review-editor/styles', null],
  ['editor:./review-editor/examples', null],
  ['editor:./diff-viewer', null],
  ['editor:./diff-viewer/schema', null],
  ['editor:./diff-viewer/variables', null],
  ['editor:./diff-viewer/styles', null],
  ['editor:./diff-viewer/examples', null],
]);

/**
 * Shape of an upstream `exports` entry. `editor` (still workspace-private)
 * points `types` AND `bun` at `./src/**`, so a workspace consumer always sees
 * fresh types and runtime with no build step. `@lostgradient/markdown`
 * (published, see `docs/decisions/package-boundaries.md` Phase 2) keeps
 * `types` pointing at `dist/**` like every other published sibling package —
 * only `bun` points at `./src/**`, so a workspace `bun test`/`bun run`
 * resolves the package's own self-imports without a build first, while
 * `pack-for-publish.ts` drops the `bun` condition entirely from the
 * published tarball (which has no `src/`).
 */
type UpstreamConditionalExport = {
  types?: string;
  bun?: string;
  import?: string;
  default?: string;
};

type UpstreamExportsMap = Record<string, UpstreamConditionalExport | string>;

type UpstreamPackageManifest = {
  name?: string;
  exports?: UpstreamExportsMap;
};

/**
 * Validate the subset of an upstream `package.json` we rely on.
 *
 * Unlike this package's own generated files, upstream manifests are not produced
 * by this pipeline — an upstream package could restructure its `exports` map. A
 * real guard (rather than an `as` assertion) catches that divergence at the read
 * site instead of letting a wrongly-typed value flow downstream. Only the fields
 * actually consumed here are checked; everything else stays optional.
 */
function isUpstreamPackageManifest(value: unknown): value is UpstreamPackageManifest {
  if (typeof value !== 'object' || value === null) return false;
  if ('exports' in value) {
    const { exports } = value;
    if (exports !== undefined && (typeof exports !== 'object' || exports === null)) {
      return false;
    }
  }
  return true;
}

export type UpstreamReexport = {
  /** `markdown` | `editor` | `editor` | `diff`. */
  pkg: UpstreamPackageName;
  /** Subpath as written in the upstream exports map (e.g. `.`, `./pipeline`, `./diff/line-diff`). */
  upstreamSubpath: string;
  /** The cinder-side exports key (e.g. `./markdown`, `./markdown/pipeline`). */
  cinderKey: string;
  /**
   * Path relative to `packages/components/src/` of the generated re-export
   * source file, including the `.ts` extension
   * (e.g. `markdown/index.ts`, `markdown/diff/line-diff.ts`).
   */
  sourceRelativePath: string;
  /**
   * Path relative to `packages/components/src/` of the generated re-export
   * source file, WITHOUT the extension. Used as the build entrypoint name
   * (e.g. `markdown/index`).
   */
  sourceEntrypoint: string;
  /**
   * Path relative to `packages/components/dist/` of the built JS file
   * (e.g. `markdown/index.js`).
   */
  distRelativePath: string;
  /**
   * Path relative to `packages/components/dist/` where the upstream
   * package's OWN build output actually lands after step 5c copies its
   * `dist/**` verbatim (e.g. `markdown/templates/sanitize-html.js`) — i.e.
   * the un-overridden `${pkg}/<subpath>.js` path. Equal to
   * `distRelativePath` unless `CINDER_KEY_OVERRIDES` remaps this subpath, in
   * which case `build.ts` writes a thin `export *` redirect shim at
   * `distRelativePath` pointing back at this real vendored file, rather than
   * duplicating (and breaking the internal relative-import graph of) the
   * compiled output.
   */
  vendoredDistRelativePath: string;
  /** Import specifier used inside the re-export file (e.g. `@cinder/markdown/pipeline`). */
  upstreamSpecifier: string;
};

/**
 * Reads each upstream `package.json#exports` and produces one `UpstreamReexport`
 * per public sub-path. The result is sorted deterministically by package then
 * by cinder key.
 */
export async function deriveUpstreamReexports(): Promise<UpstreamReexport[]> {
  const out: UpstreamReexport[] = [];

  for (const pkg of UPSTREAM_PACKAGES) {
    const manifestPath = join(WORKSPACE_ROOT, 'packages', pkg, 'package.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`Upstream package manifest missing: ${manifestPath}`);
    }
    const parsed: unknown = await Bun.file(manifestPath).json();
    if (!isUpstreamPackageManifest(parsed)) {
      throw new Error(`Upstream package manifest has an unexpected shape: ${manifestPath}`);
    }
    const exportsMap = parsed.exports ?? {};

    for (const [upstreamSubpath, entry] of Object.entries(exportsMap)) {
      if (upstreamSubpath === './package.json') continue;

      // A suppressed subpath is real upstream surface (resolvable via its own
      // package's exports map) but must not flow through to cinder — see
      // `CINDER_KEY_OVERRIDES`. Checked before the bare-string guard below
      // because suppressed entries (e.g. `editor`'s manifest and Svelte
      // component subpaths, which are plain-string JSON/component exports,
      // not conditional objects) are never parsed as a re-export in the
      // first place.
      const overrideKey = `${pkg}:${upstreamSubpath}`;
      const override = CINDER_KEY_OVERRIDES.get(overrideKey);
      if (override === null) continue;

      if (typeof entry === 'string') {
        // We do not currently consume string-shorthand exports from upstream
        // packages — surface as a hard error so this stays explicit.
        throw new Error(
          `Upstream ${pkg} exports[${upstreamSubpath}] is a bare string; expected a conditional object.`,
        );
      }

      // Decide whether the upstream entry points at a directory-style entry
      // (e.g. `src/pipeline/index.ts`) — in that case our re-export file
      // becomes `<subpath>/index.ts`. Otherwise the file matches the subpath.
      // Resolved directly against the on-disk source tree rather than
      // sniffed from the exports-map string: `@lostgradient/markdown`'s
      // published exports point at `dist/*.d.ts` (no source condition), so
      // there is no `.ts`-suffixed string to pattern-match against.
      const stripped = upstreamSubpath === '.' ? '' : upstreamSubpath.replace(/^\.\//, '');
      const isDirectoryEntry = existsSync(
        join(WORKSPACE_ROOT, 'packages', pkg, upstreamSourceRoot(pkg), stripped, 'index.ts'),
      );

      let baseRelative: string;
      let cinderKey: string;
      const upstreamPackageName = UPSTREAM_PACKAGE_NAMES[pkg];
      const upstreamSpecifier =
        upstreamSubpath === '.' ? upstreamPackageName : `${upstreamPackageName}/${stripped}`;

      // The natural (never overridden) location, always computed the same
      // way regardless of `CINDER_KEY_OVERRIDES` — this is where the
      // upstream package's own `dist/**` actually lands after step 5c's
      // verbatim copy.
      const naturalBaseRelative =
        upstreamSubpath === '.'
          ? `${pkg}/index`
          : isDirectoryEntry
            ? `${pkg}/${stripped}/index`
            : `${pkg}/${stripped}`;

      if (override !== undefined) {
        cinderKey = override;
        const overrideStripped = override.replace(/^\.\//, '');
        baseRelative = isDirectoryEntry ? `${overrideStripped}/index` : overrideStripped;
      } else if (upstreamSubpath === '.') {
        baseRelative = `${pkg}/index`;
        cinderKey = `./${pkg}`;
      } else {
        baseRelative = isDirectoryEntry ? `${pkg}/${stripped}/index` : `${pkg}/${stripped}`;
        cinderKey = `./${pkg}/${stripped}`;
      }

      out.push({
        pkg,
        upstreamSubpath,
        cinderKey,
        sourceRelativePath: `${baseRelative}.ts`,
        sourceEntrypoint: baseRelative,
        distRelativePath: `${baseRelative}.js`,
        vendoredDistRelativePath: `${naturalBaseRelative}.js`,
        upstreamSpecifier,
      });
    }
  }

  out.sort((a, b) => {
    if (a.pkg !== b.pkg) return UPSTREAM_PACKAGES.indexOf(a.pkg) - UPSTREAM_PACKAGES.indexOf(b.pkg);
    return a.cinderKey.localeCompare(b.cinderKey);
  });
  return out;
}

/**
 * Resolve the absolute on-disk path of an upstream package's source entry
 * for a given exports-map sub-path. Used by {@link reexportFileBody} to
 * introspect what the upstream module actually exports.
 *
 * Resolved directly against the on-disk `src/` tree (the same convention
 * {@link deriveUpstreamReexports} uses to decide `isDirectoryEntry`) rather
 * than read back out of the upstream package's exports map: a published
 * package (`@lostgradient/markdown`) points its exports at `dist/*.d.ts`, which
 * has no `.ts` source to introspect.
 */
function resolveUpstreamSourcePath(reexport: UpstreamReexport): string {
  const stripped =
    reexport.upstreamSubpath === '.' ? '' : reexport.upstreamSubpath.replace(/^\.\//, '');
  const packageSourceRoot = join(
    WORKSPACE_ROOT,
    'packages',
    reexport.pkg,
    upstreamSourceRoot(reexport.pkg),
  );
  const directoryCandidate = join(packageSourceRoot, stripped, 'index.ts');
  if (existsSync(directoryCandidate)) return directoryCandidate;
  const fileCandidate = join(packageSourceRoot, `${stripped || 'index'}.ts`);
  if (existsSync(fileCandidate)) return fileCandidate;
  throw new Error(
    `Cannot resolve source path for ${reexport.upstreamSpecifier}: tried ${directoryCandidate} and ${fileCandidate}.`,
  );
}

/**
 * Collect the public value and type names exported from a TypeScript source
 * file (and recursively through any `export *` it contains). Used to emit
 * explicit named re-exports in {@link reexportFileBody} — see the comment
 * there for why `export *` does not work for cinder's shells.
 */
function collectExports(entryPath: string): { values: string[]; types: string[] } {
  const valueSet = new Set<string>();
  const typeSet = new Set<string>();
  const visited = new Set<string>();

  function resolveImport(currentPath: string, importPath: string): string {
    const currentDir = dirname(currentPath);
    // Strip a trailing `.js` and try `.ts` candidates.
    const stripped = importPath.replace(/\.js$/, '');
    const candidates = [
      join(currentDir, `${stripped}.ts`),
      join(currentDir, stripped, 'index.ts'),
      join(currentDir, `${stripped}.tsx`),
      join(currentDir, `${stripped}.d.ts`),
      join(currentDir, importPath),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    throw new Error(
      `Cannot resolve relative import "${importPath}" from "${currentPath}". Tried: ${candidates.join(', ')}`,
    );
  }

  function walk(filePath: string): void {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    const raw = readFileSync(filePath, 'utf-8');
    // Strip comments before regex-matching so commented-out exports don't
    // accidentally enter the binding set.
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    // `export type { A, B as C } from './x';` — collect type names.
    for (const match of source.matchAll(
      /^\s*export\s+type\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/gm,
    )) {
      const names = parseNameList(match[1]!);
      for (const name of names) typeSet.add(name);
    }
    // `export { A, B as C } from './x';` — collect (presume value).
    // Distinguish from `export type {…}` by ensuring no `type` keyword on
    // the export. The regex above runs first and consumes those lines from
    // the perspective of the source string, but a single line can match
    // both — guard with a negative-lookbehind-ish check by re-testing.
    for (const match of source.matchAll(/^\s*export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/gm)) {
      // Skip if this is actually `export type { … } from '…'` (the regex
      // above would also fire if we relaxed it).
      if (/^\s*export\s+type\s*\{/.test(match[0])) continue;
      const inner = match[1]!;
      // Per-name: items prefixed with `type` are type-only inside an
      // otherwise-mixed clause.
      for (const piece of inner.split(',')) {
        const trimmed = piece.trim();
        if (!trimmed) continue;
        const typeOnly = /^type\s+/.test(trimmed);
        const exposed = trimmed
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)
          .pop()!
          .trim();
        if (typeOnly) typeSet.add(exposed);
        else valueSet.add(exposed);
      }
    }
    // `export const|let|var|function|async function|class NAME` — value.
    for (const match of source.matchAll(
      /^\s*export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/gm,
    )) {
      valueSet.add(match[1]!);
    }
    // `export type NAME = …` / `export interface NAME` / `export enum NAME`.
    for (const match of source.matchAll(
      /^\s*export\s+(?:type|interface|enum)\s+([A-Za-z0-9_$]+)/gm,
    )) {
      typeSet.add(match[1]!);
    }
    // `export { A, B };` (no `from`) — local re-exports of in-scope bindings.
    for (const match of source.matchAll(/^\s*export\s*\{([^}]+)\}\s*;?\s*$/gm)) {
      // Skip `export { … } from …` (already handled).
      if (/from\s*['"]/.test(match[0])) continue;
      for (const piece of match[1]!.split(',')) {
        const trimmed = piece.trim();
        if (!trimmed) continue;
        const typeOnly = /^type\s+/.test(trimmed);
        const exposed = trimmed
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)
          .pop()!
          .trim();
        if (typeOnly) typeSet.add(exposed);
        else valueSet.add(exposed);
      }
    }
    // `export * from './x';` — recurse.
    for (const match of source.matchAll(/^\s*export\s*\*\s*from\s*['"]([^'"]+)['"]/gm)) {
      const importPath = match[1]!;
      if (!importPath.startsWith('.')) continue;
      walk(resolveImport(filePath, importPath));
    }
    // `export * as <name> from './x';` — namespace re-export. The whole
    // namespace becomes a single value export under the chosen name.
    for (const match of source.matchAll(
      /^\s*export\s*\*\s*as\s+([A-Za-z0-9_$]+)\s+from\s*['"][^'"]+['"]/gm,
    )) {
      valueSet.add(match[1]!);
    }
  }

  walk(entryPath);

  // A value-and-type collision (a class is both a value and a type) stays
  // in the value list — the runtime export forwards both via TypeScript's
  // dual-meaning class semantics.
  for (const name of valueSet) typeSet.delete(name);

  return {
    values: [...valueSet].toSorted(),
    types: [...typeSet].toSorted(),
  };
}

/** Parse a `{ a, b as c, type d }` clause and return the public names. */
function parseNameList(inner: string): string[] {
  return inner
    .split(',')
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece) =>
      piece
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()!
        .trim(),
    );
}

/**
 * Canonical body for a generated re-export file. Emits explicit named
 * re-exports — value bindings and (separately) type-only bindings.
 *
 * Why not `export *`? Bun.build drops some bindings under chained
 * `export *` re-exports when bundled through workspace symlinks: the
 * playground bundle emitted `MarkdownParseError2` references without a
 * matching import statement, producing a `SyntaxError: Export
 * 'MarkdownParseError2' is not defined in module` at the module-load
 * boundary. Explicit named re-exports keep the import-link visible to the
 * bundler so it tracks the binding through the shell. The check-mode drift
 * detector still works because every shell is regenerated by introspecting
 * the upstream source — adding a new upstream export shows up as drift.
 */
export function reexportFileBody(upstreamSpecifier: string, reexport?: UpstreamReexport): string {
  const header = [
    '// Generated by scripts/generate-exports.ts — do not edit by hand.',
    `// Re-exports the public surface of \`${upstreamSpecifier}\` as a cinder sub-path.`,
  ];

  // Back-compat for any caller that doesn't pass the full reexport object
  // (e.g. fixtures). Without the metadata we can't resolve the source path,
  // so fall back to `export *`.
  if (reexport === undefined) {
    return [...header, `export * from '${upstreamSpecifier}';`, ''].join('\n');
  }

  const sourcePath = resolveUpstreamSourcePath(reexport);
  const { values, types } = collectExports(sourcePath);

  const lines = [...header];
  if (values.length === 0 && types.length === 0) {
    // No exports found — keep `export *` so an upstream module that uses
    // exotic re-export forms (e.g. `export * as ns from …`) we don't yet
    // parse doesn't silently lose its surface.
    lines.push(`export * from '${upstreamSpecifier}';`);
  } else {
    if (values.length > 0) {
      lines.push(formatNamedExport('export', values, upstreamSpecifier));
    }
    if (types.length > 0) {
      lines.push(formatNamedExport('export type', types, upstreamSpecifier));
    }
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Format a named-re-export clause the way Prettier (printWidth 100, trailing
 * comma "all") would write it. Emits single-line when the clause fits within
 * 100 columns, multi-line otherwise. Keeping the generator's output Prettier-
 * idempotent avoids drift between `bun run exports:generate` and the
 * post-write `prettier --write` lint-staged step.
 */
function formatNamedExport(
  prefix: 'export' | 'export type',
  names: string[],
  specifier: string,
): string {
  const PRINT_WIDTH = 100;
  const inline = `${prefix} { ${names.join(', ')} } from '${specifier}';`;
  if (inline.length <= PRINT_WIDTH) return inline;
  return `${prefix} {\n${names.map((name) => `  ${name},`).join('\n')}\n} from '${specifier}';`;
}

/**
 * Build a cinder exports-map entry for a single upstream sub-path. Mirrors
 * the conditional shape used by component sub-paths (types/browser/node/
 * svelte/import/default), so browser/source tooling resolves the `.ts` source
 * for HMR and type checks, while published Node SSR consumers resolve
 * `dist/server/`.
 *
 * Note: the in-repo `node` condition points at `dist/server/<rel>` so the
 * server build can resolve these sub-paths from `dist/server` once `build.ts`
 * adds them; if the server build does not yet emit a given sub-path, the
 * post-build resolution gate in `validate-consumers.ts` will catch it.
 */
export function cinderExportEntry(reexport: UpstreamReexport): {
  types: string;
  browser: string;
  svelte: string;
  node: string;
  import: string;
  default: string;
} {
  const { sourceRelativePath, distRelativePath } = reexport;
  return {
    types: `./dist/${distRelativePath.replace(/\.js$/, '.d.ts')}`,
    browser: `./src/${sourceRelativePath}`,
    svelte: `./src/${sourceRelativePath}`,
    node: `./dist/server/${distRelativePath}`,
    import: `./src/${sourceRelativePath}`,
    default: `./dist/${distRelativePath}`,
  };
}

/** Absolute path to the generated source file for a given re-export. */
export function reexportSourceAbsolutePath(reexport: UpstreamReexport): string {
  return join(COMPONENTS_PACKAGE_ROOT, 'src', reexport.sourceRelativePath);
}
