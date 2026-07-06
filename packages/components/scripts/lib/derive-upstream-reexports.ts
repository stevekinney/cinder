/**
 * Derives `@lostgradient/cinder/<pkg>/<subpath>` re-exports from the public `exports` map of
 * each `@cinder/*` workspace package (`markdown`, `editor`, `commentary`,
 * `diff`).
 *
 * The four workspace packages stay on disk as source-only inputs. Their
 * public sub-paths are mechanically mirrored into `@lostgradient/cinder`'s exports map as
 * `./<pkg>/<subpath>` entries, and a thin re-export file is generated under
 * `packages/components/src/<pkg>/<subpath>.ts`. The cinder build bundles
 * those re-export entrypoints into `dist/` so the published `@lostgradient/cinder` package
 * has zero runtime dependency on `@cinder/*`.
 *
 * Acceptance criterion: every public sub-path in each upstream
 * `package.json#exports` appears in cinder's exports map. CI fails on drift
 * (see `generate-exports.ts`'s check mode).
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
 * The four `@cinder/*` workspace packages whose public exports flow through
 * `@lostgradient/cinder/<pkg>/*`. Order is significant only for deterministic output.
 */
export const UPSTREAM_PACKAGES = ['markdown', 'editor', 'commentary', 'diff'] as const;

export type UpstreamPackageName = (typeof UPSTREAM_PACKAGES)[number];

/**
 * Shape of an upstream `exports` entry. The upstream packages use the
 * `types`/`bun`/`import`/`default` condition shape (see
 * `packages/<pkg>/package.json`).
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
  /** `markdown` | `editor` | `commentary` | `diff`. */
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
      if (typeof entry === 'string') {
        // We do not currently consume string-shorthand exports from upstream
        // packages — surface as a hard error so this stays explicit.
        throw new Error(
          `Upstream ${pkg} exports[${upstreamSubpath}] is a bare string; expected a conditional object.`,
        );
      }

      // Decide whether the upstream entry points at a directory-style entry
      // (e.g. `./src/pipeline/index.ts`) — in that case our re-export file
      // becomes `<subpath>/index.ts`. Otherwise the file matches the subpath.
      const upstreamTypes = entry.types ?? entry.bun ?? entry.import ?? entry.default;
      const isDirectoryEntry =
        typeof upstreamTypes === 'string' && upstreamTypes.endsWith('/index.ts');

      let baseRelative: string;
      let cinderKey: string;
      let upstreamSpecifier: string;
      if (upstreamSubpath === '.') {
        baseRelative = `${pkg}/index`;
        cinderKey = `./${pkg}`;
        upstreamSpecifier = `@cinder/${pkg}`;
      } else {
        const stripped = upstreamSubpath.replace(/^\.\//, '');
        baseRelative = isDirectoryEntry ? `${pkg}/${stripped}/index` : `${pkg}/${stripped}`;
        cinderKey = `./${pkg}/${stripped}`;
        upstreamSpecifier = `@cinder/${pkg}/${stripped}`;
      }

      out.push({
        pkg,
        upstreamSubpath,
        cinderKey,
        sourceRelativePath: `${baseRelative}.ts`,
        sourceEntrypoint: baseRelative,
        distRelativePath: `${baseRelative}.js`,
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
 */
function resolveUpstreamSourcePath(reexport: UpstreamReexport): string {
  const manifestPath = join(WORKSPACE_ROOT, 'packages', reexport.pkg, 'package.json');
  const manifestRaw = readFileSync(manifestPath, 'utf-8');
  const parsed: unknown = JSON.parse(manifestRaw);
  if (!isUpstreamPackageManifest(parsed)) {
    throw new Error(`Upstream package manifest has an unexpected shape: ${manifestPath}`);
  }
  const exportsMap = parsed.exports ?? {};
  const entry = exportsMap[reexport.upstreamSubpath];
  if (!entry || typeof entry === 'string') {
    throw new Error(
      `Cannot resolve source path for ${reexport.upstreamSpecifier}: exports entry missing or string-shorthand.`,
    );
  }
  const sourceRel = entry.types ?? entry.bun ?? entry.import ?? entry.default;
  if (typeof sourceRel !== 'string') {
    throw new Error(
      `Cannot resolve source path for ${reexport.upstreamSpecifier}: no usable condition.`,
    );
  }
  return join(WORKSPACE_ROOT, 'packages', reexport.pkg, sourceRel);
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
