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
 * Matches only a bare side-effect `import '<path>';` with no `from` — the CSS import shape
 * `emitDts()`/`svelte-package` actually emit into a `.d.ts` barrel (`import './access-gate.css';`,
 * preserved verbatim from the source component's own side-effect CSS import). Kept separate from
 * {@link RELATIVE_SPECIFIER_PATTERN} rather than folded into it: every existing caller of
 * {@link findRelativeSpecifiers} relies on side-effect imports being excluded (see its doc
 * comment), and only the arbitrary-extension check below needs them too.
 */
const SIDE_EFFECT_RELATIVE_SPECIFIER_PATTERN = /^\s*import\s+['"](\.[^'"]+)['"];?\s*$/gm;

/** Every relative specifier a bare side-effect `import '<path>';` (no `from`) references. */
export function findSideEffectRelativeSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  for (const match of content.matchAll(SIDE_EFFECT_RELATIVE_SPECIFIER_PATTERN)) {
    const specifier = match[1];
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
 * `.svelte`/`.css` are "arbitrary extension" specifiers: under Node16/bundler ESM resolution
 * (the mode a `"type": "module"` package's own `.d.ts` files resolve under — see COR-1196's
 * `attw` proof), TypeScript does not accept the Svelte ecosystem's own `<name>.svelte.d.ts` /
 * `<name>.css.d.ts` declaration-file convention for a bare `import './x.svelte'` /
 * `import './x.css'` found INSIDE a `.d.ts` file. It only accepts `<name>.d.svelte.ts` /
 * `<name>.d.css.ts` — extension inserted before the final `.ts`, not appended after it. (A
 * `tsc --traceResolution` repro against a real `"type": "module"` package.json is what pinned
 * this down: CJS-mode resolution falls back to the `.svelte.d.ts` convention, but ESM/`import`-mode
 * resolution — what a real consumer's `"types"` condition uses — never does.) `emitDts()` (cinder)
 * and `svelte-package` (chat, editor) both only ever emit the old convention, so every `.svelte`/
 * `.css` specifier a `.d.ts` file references needs a companion in the new convention too;
 * `emit-arbitrary-extension-declarations.ts` creates it, and the two functions below detect a gap.
 */
const ARBITRARY_EXTENSIONS = new Set(['.svelte', '.css']);

/** Whether `specifier`'s target extension is one where Node16/bundler needs an arbitrary-extension declaration file. */
export function isArbitraryExtensionSpecifier(specifier: string): boolean {
  const dot = specifier.lastIndexOf('.');
  if (dot === -1) return false;
  return ARBITRARY_EXTENSIONS.has(specifier.slice(dot));
}

/**
 * The Node16/bundler-ESM-correct declaration path for an arbitrary-extension specifier, given the
 * specifier resolved against its importer's directory (still carrying the `.svelte`/`.css`
 * extension, e.g. `components/access-gate/access-gate.svelte`). Returns
 * `components/access-gate/access-gate.d.svelte.ts`.
 */
export function arbitraryExtensionDeclarationPath(resolvedPathWithExtension: string): string {
  const dot = resolvedPathWithExtension.lastIndexOf('.');
  const base = resolvedPathWithExtension.slice(0, dot);
  const extension = resolvedPathWithExtension.slice(dot + 1);
  return `${base}.d.${extension}.ts`;
}

export interface UnresolvedArbitraryExtensionImport {
  readonly file: string;
  readonly specifier: string;
  /** The `<base>.d.<ext>.ts` path this specifier needs, relative to the `dist/` root. */
  readonly requiredDeclarationPath: string;
}

/**
 * Every `.svelte`/`.css` specifier in a `.d.ts` file's content whose Node16/bundler-correct
 * `<base>.d.<ext>.ts` companion does not exist under `fileExists`. Only `.d.ts` files are scanned —
 * a `.js` runtime file never needs a type declaration for its own CSS/Svelte imports.
 */
export function findUnresolvedArbitraryExtensionImports(
  file: string,
  content: string,
  fileExists: (distRelativePath: string) => boolean,
): UnresolvedArbitraryExtensionImport[] {
  if (!file.endsWith('.d.ts')) return [];
  const offenders: UnresolvedArbitraryExtensionImport[] = [];
  const directory = dirname(file);
  const specifiers = [
    ...findRelativeSpecifiers(content),
    ...findSideEffectRelativeSpecifiers(content),
  ];
  for (const specifier of specifiers) {
    if (!isArbitraryExtensionSpecifier(specifier)) continue;
    const resolvedPath = normalize(join(directory, specifier));
    const requiredDeclarationPath = arbitraryExtensionDeclarationPath(resolvedPath);
    if (fileExists(requiredDeclarationPath)) continue;
    offenders.push({ file, specifier, requiredDeclarationPath });
  }
  return offenders;
}

/**
 * Matches a dynamic type-only self-reference `import(".").TypeName` — a bare `"."` specifier
 * (the package root, not a real relative path) immediately followed by a property/type access.
 * Seen in every generated compound-component barrel (`grid`, `radio-group`, `speed-dial`, `tabs`,
 * `tree`, …): `emitDts()` mis-computes the relative path for a nested sub-component's prop type
 * referenced only through TypeScript's `import()` type operator (as opposed to a static
 * `export type { X } from '<path>'`, which the same file gets right for the very same type — see
 * `findMatchingReexportPath` below, which uses that correct statement to fix this one). `"."` is
 * never a legitimate specifier here: Node's self-referencing-imports feature requires the
 * package's own *name*, not a literal dot, so this is unconditionally a build defect, not a
 * "points at raw src on purpose" shape.
 */
const SELF_REFERENCE_TYPE_IMPORT_PATTERN = /import\(\s*(['"])\.\1\s*\)\.([A-Za-z_$][\w$]*)/g;

export interface SelfReferentialTypeImport {
  readonly file: string;
  readonly typeName: string;
}

/** Every `import(".").TypeName` self-reference in a `.d.ts` file's content. */
export function findSelfReferentialTypeImports(
  file: string,
  content: string,
): SelfReferentialTypeImport[] {
  if (!file.endsWith('.d.ts')) return [];
  const offenders: SelfReferentialTypeImport[] = [];
  for (const match of content.matchAll(SELF_REFERENCE_TYPE_IMPORT_PATTERN)) {
    const typeName = match[2];
    if (typeName) offenders.push({ file, typeName });
  }
  return offenders;
}

/**
 * The relative path a same-file `export type { …, typeName, … } from '<path>'` statement
 * re-exports `typeName` through, or `undefined` if no such statement exists in `content`. Used to
 * repair a {@link SELF_REFERENCE_TYPE_IMPORT_PATTERN} match: the file that got the `import(".")`
 * relative path wrong for `typeName` almost always re-exports that same type correctly a few
 * lines away.
 */
export function findMatchingReexportPath(content: string, typeName: string): string | undefined {
  const exportTypePattern = /export\s+type\s+\{([^}]*)\}\s+from\s+(['"])([^'"]+)\2/g;
  for (const match of content.matchAll(exportTypePattern)) {
    const names = match[1] ?? '';
    const path = match[3];
    if (!path) continue;
    const nameBoundary = new RegExp(`(?:^|[,{\\s])${typeName}(?:$|[,}\\s])`);
    if (nameBoundary.test(names)) return path;
  }
  return undefined;
}

export interface ExtensionlessDeclarationSpecifier {
  readonly file: string;
  readonly specifier: string;
}

/**
 * Every bare (extensionless) relative specifier in a `.d.ts` file's content. Node16/bundler ESM
 * resolution requires an explicit extension on every relative specifier — there is no directory-
 * index or extension-adding fallback the way Node's CJS resolver has one — so an extensionless
 * relative specifier inside compiled `.d.ts` output is unconditionally wrong; unlike the
 * `.svelte`/`.ts` exemption in {@link requiresDistMaterialization}, there is no "points at raw src
 * on purpose" reading of a specifier that lives entirely inside `dist/`'s own declaration graph.
 */
export function findExtensionlessDeclarationSpecifiers(
  file: string,
  content: string,
): ExtensionlessDeclarationSpecifier[] {
  if (!file.endsWith('.d.ts')) return [];
  const offenders: ExtensionlessDeclarationSpecifier[] = [];
  for (const specifier of findRelativeSpecifiers(content)) {
    const lastSegment = specifier.slice(specifier.lastIndexOf('/') + 1);
    if (lastSegment.includes('.')) continue;
    offenders.push({ file, specifier });
  }
  return offenders;
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
