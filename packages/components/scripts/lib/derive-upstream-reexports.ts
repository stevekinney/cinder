/**
 * Derives `cinder/<pkg>/<subpath>` re-exports from the public `exports` map of
 * each `@cinder/*` workspace package (`markdown`, `editor`, `commentary`,
 * `diff`).
 *
 * The four workspace packages stay on disk as source-only inputs. Their
 * public sub-paths are mechanically mirrored into `cinder`'s exports map as
 * `./<pkg>/<subpath>` entries, and a thin re-export file is generated under
 * `packages/components/src/<pkg>/<subpath>.ts`. The cinder build bundles
 * those re-export entrypoints into `dist/` so the published `cinder` package
 * has zero runtime dependency on `@cinder/*`.
 *
 * Acceptance criterion: every public sub-path in each upstream
 * `package.json#exports` appears in cinder's exports map. CI fails on drift
 * (see `generate-exports.ts`'s check mode).
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

/** Root of the cinder repository (workspace root). */
const WORKSPACE_ROOT = join(scriptDirectory, '..', '..', '..', '..');

/** Root of the `cinder` (`packages/components`) package. */
const COMPONENTS_PACKAGE_ROOT = join(scriptDirectory, '..', '..');

/**
 * The four `@cinder/*` workspace packages whose public exports flow through
 * `cinder/<pkg>/*`. Order is significant only for deterministic output.
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
    const manifest = (await Bun.file(manifestPath).json()) as UpstreamPackageManifest;
    const exportsMap = manifest.exports ?? {};

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
 * Canonical body for a generated re-export file. All upstream modules use
 * named-only exports (no default exports anywhere in `@cinder/markdown`,
 * `@cinder/editor`, `@cinder/commentary`, or `@cinder/diff` as of PR 1), so
 * `export *` is sufficient and forwards both type and value exports under
 * TypeScript's `verbatimModuleSyntax`. If a future upstream module adds a
 * default export, the generator must be updated to emit
 * `export { default } from '<specifier>';` alongside `export *` — drift
 * detection in `--check` mode catches that.
 */
export function reexportFileBody(upstreamSpecifier: string): string {
  return [
    '// Generated by scripts/generate-exports.ts — do not edit by hand.',
    `// Re-exports the public surface of \`${upstreamSpecifier}\` as a cinder sub-path.`,
    `export * from '${upstreamSpecifier}';`,
    '',
  ].join('\n');
}

/**
 * Build a cinder exports-map entry for a single upstream sub-path. Mirrors
 * the four-condition shape used by component sub-paths (types/svelte/node/
 * default), so in-repo Svelte tooling resolves the `.ts` source for HMR and
 * type checks, while published consumers resolve `dist/`.
 *
 * Note: the in-repo `node` condition points at `dist/server/<rel>` so the
 * server build can resolve these sub-paths from `dist/server` once `build.ts`
 * adds them; if the server build does not yet emit a given sub-path, the
 * post-build resolution gate in `validate-consumers.ts` will catch it.
 */
export function cinderExportEntry(reexport: UpstreamReexport): {
  types: string;
  svelte: string;
  node: string;
  default: string;
} {
  const { sourceRelativePath, distRelativePath } = reexport;
  return {
    types: `./dist/${distRelativePath.replace(/\.js$/, '.d.ts')}`,
    svelte: `./src/${sourceRelativePath}`,
    node: `./dist/server/${distRelativePath}`,
    default: `./dist/${distRelativePath}`,
  };
}

/** Absolute path to the generated source file for a given re-export. */
export function reexportSourceAbsolutePath(reexport: UpstreamReexport): string {
  return join(COMPONENTS_PACKAGE_ROOT, 'src', reexport.sourceRelativePath);
}
