import { dirname, join, normalize } from 'node:path';

/**
 * Shared utilities for finding relative import/export/dynamic-import specifiers in compiled
 * `.js` / `.d.ts` output and deciding which of them must resolve to a real file under `dist/`.
 *
 * Two things use this:
 *   - `scripts/build.ts` — mirrors every JSON file the compiled `.d.ts` output imports (tokens
 *     JSON, per-component `.constraints.json`/`.examples.json`) from `src/` into the matching
 *     `dist/` path, then runs the resolution check below as a build-time gate so a future static
 *     asset the build forgets to copy fails the build immediately instead of shipping a tarball
 *     whose `.d.ts` files reference files that do not exist (COR-1196: this is exactly how
 *     1,184 `attw` `InternalResolutionError`s reached the published cinder tarball — every JSON
 *     sidecar `src/exports/metadata-*.ts` imports with `with { type: 'json' }` compiled into a
 *     `.d.ts` import specifier the build never gave a `dist/` target).
 *
 * `.ts`/`.tsx`/`.svelte` specifiers are deliberately excluded from the "must resolve under dist"
 * set: cinder's `browser`/`svelte` export conditions point every component subpath at its raw
 * `./src/**` source (see `generate-exports.ts`'s `computeRootExport` and the per-component
 * `computeExports`) so a Svelte-aware bundler resolves component source directly rather than
 * coupling every consumer to one compiled Svelte runtime shape. A `.d.ts` file that faithfully
 * mirrors a `.ts` source's own relative imports of sibling `.ts`/`.svelte` files is therefore
 * expected to reference a path that has no `dist/`-rooted counterpart at all — that is the
 * intended shape, not a build gap, and flagging it would make this guard fail on every build.
 */

/**
 * Matches a relative (`./` or `../`) specifier in a static `from '<path>'` clause (covers
 * `import ... from`, `export ... from`, `export * from`) or a dynamic `import('<path>')` call.
 * Deliberately does not match a bare side-effect `import '<path>';` with no `from` — the compiled
 * `.d.ts` output this module scans never carries one (side-effect imports like the source
 * barrel's `import './styles/index.css'` are CSS, a different class this module does not cover;
 * see the module doc comment).
 */
const RELATIVE_SPECIFIER_PATTERN =
  /\bfrom\s+['"](\.[^'"]+)['"]|\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g;

/** Every relative specifier `content` references through a static or dynamic `from`/`import()` form. */
export function findRelativeSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  for (const match of content.matchAll(RELATIVE_SPECIFIER_PATTERN)) {
    const specifier = match[1] ?? match[2];
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
}

/**
 * Extensions whose target must be a real, standalone file under `dist/` once the build finishes —
 * static data with no source-condition fallback. `.ts`/`.tsx`/`.svelte` are excluded on purpose;
 * see the module doc comment.
 */
const MATERIALIZED_EXTENSIONS = new Set(['.json', '.css', '.js', '.mjs', '.cjs']);

/** Whether `specifier`'s target extension is one {@link MATERIALIZED_EXTENSIONS} requires resolving. */
export function requiresDistMaterialization(specifier: string): boolean {
  const dot = specifier.lastIndexOf('.');
  if (dot === -1) return false;
  return MATERIALIZED_EXTENSIONS.has(specifier.slice(dot));
}

export interface UnresolvedRelativeImport {
  /** The scanned file's path, relative to the `dist/` root. */
  readonly file: string;
  readonly specifier: string;
  /** The specifier resolved against `file`'s directory, relative to the `dist/` root. */
  readonly resolvedPath: string;
}

/**
 * Every relative specifier in `content` (the contents of `file`, given as a `dist/`-relative
 * path) that requires dist materialization and does not resolve under `fileExists` — which is
 * handed a `dist/`-relative path and returns whether a real file exists there, so the caller
 * decides how "exists" is checked (the real filesystem in `build.ts`, an in-memory set in tests).
 *
 * A `.js` specifier read from a `.d.ts` file also accepts a sibling `.d.ts`: TypeScript's own
 * `nodenext` declaration-emit convention keeps the `.js` extension in a declaration file's own
 * specifier even when only the `.d.ts` twin exists on disk (the compiled `.js` for a
 * `types`-only, source-mapped-away helper, or simply because the specifier is read before the
 * corresponding `.js` is confirmed present) — resolving to the `.d.ts` twin is what a real
 * `nodenext` consumer does too, so treating only the literal `.js` as satisfying would flag a
 * shape TypeScript itself considers resolved.
 */
export function findUnresolvedRelativeImports(
  file: string,
  content: string,
  fileExists: (distRelativePath: string) => boolean,
): UnresolvedRelativeImport[] {
  const offenders: UnresolvedRelativeImport[] = [];
  const directory = dirname(file);
  for (const specifier of findRelativeSpecifiers(content)) {
    if (!requiresDistMaterialization(specifier)) continue;
    const resolvedPath = normalize(join(directory, specifier));
    if (fileExists(resolvedPath)) continue;
    if (specifier.endsWith('.js') && file.endsWith('.d.ts')) {
      const declarationSibling = `${resolvedPath.slice(0, -'.js'.length)}.d.ts`;
      if (fileExists(declarationSibling)) continue;
    }
    offenders.push({ file, specifier, resolvedPath });
  }
  return offenders;
}
