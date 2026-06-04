/**
 * Source `index.ts` CSS-import rewriter.
 *
 * Prepends a relative side-effect `import './<name>.css';` as the FIRST import
 * of every component's SOURCE entry (`src/components/[experimental/]<name>/index.ts`)
 * that has a co-located `<name>.css` sidecar.
 *
 * Why: the browser BUILD already injects `import '@lostgradient/cinder/<name>/styles'` into the
 * compiled per-component + barrel entries (see {@link ./css-import-plugin.ts}),
 * so `default`/`import`/`browser`/`node` consumers auto-pull styles. But the
 * `svelte` export condition — which SvelteKit/Vite resolve FIRST for a Svelte
 * library — points at this raw SOURCE `index.ts`, which the build-time transform
 * never touches. Without a CSS import here, a SvelteKit consumer who does
 * `import Button from '@lostgradient/cinder/button'` still renders SILENTLY UNSTYLED. Importing
 * the co-located sidecar closes that gap.
 *
 * Safe for SSR: only bundlers (Vite/SvelteKit with the svelte plugin) resolve
 * the `svelte` condition, and they handle `.css` natively. Bare Node SSR resolves
 * the `node` condition, which points at the SEPARATE generated server bundle
 * (`dist/server/...`, built from `server-entry.ts`) — that bundle is CSS-free and
 * never sees this source file. A relative `./<name>.css` (not `@lostgradient/cinder/<name>/styles`)
 * is correct here because the source entry is co-located with its sidecar.
 *
 * Idempotent: an entry that already imports its sidecar is left untouched.
 *
 * Usage:
 *   bun run scripts/prepend-source-index-css-import.ts          # rewrite in place
 *   bun run scripts/prepend-source-index-css-import.ts --check  # exit 1 if any drift
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { discoverComponents } from './lib/discover-components.ts';

const repositoryRoot = process.cwd();
const componentsRoot = join(repositoryRoot, 'src', 'components');

/** Absolute path to a component's source entry. */
function indexPath(name: string, isExperimental: boolean): string {
  return isExperimental
    ? join(componentsRoot, 'experimental', name, 'index.ts')
    : join(componentsRoot, name, 'index.ts');
}

/** Absolute path to a component's co-located CSS sidecar. */
function sidecarPath(name: string, isExperimental: boolean): string {
  return isExperimental
    ? join(componentsRoot, 'experimental', name, `${name}.css`)
    : join(componentsRoot, name, `${name}.css`);
}

/**
 * True when the source contains an actual side-effect `import './<name>.css'`
 * STATEMENT (single or double quoted), not merely the substring `./<name>.css`.
 * A bare substring check would be fooled by a comment or string that mentions
 * the path, leaving the real import missing while the check passes — which would
 * silently leave `svelte`-condition consumers unstyled.
 *
 * Exported so the build gate (build.ts) applies the exact same matcher.
 */
export function hasSourceCssImport(source: string, name: string): boolean {
  // Escape regex metacharacters in the component name (kebab `-` is literal, but
  // be defensive). Match `import './name.css'` / `import "./name.css"` with
  // optional trailing semicolon and surrounding whitespace.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`import\\s+['"]\\./${escaped}\\.css['"]`).test(source);
}

/**
 * Return the entry source with `import './<name>.css';` as its first line, or
 * `null` when the import is already present (no rewrite needed). The import is
 * a leading side-effect line so the sidecar loads before the component module.
 */
function withCssImport(source: string, name: string): string | null {
  if (hasSourceCssImport(source, name)) return null;
  return `import './${name}.css';\n${source}`;
}

// Run the rewrite/check only when invoked directly as a CLI — guarded so that
// importing `hasSourceCssImport` (e.g. from build.ts) doesn't trigger a rewrite.
if (import.meta.main) {
  const checkOnly = process.argv.includes('--check');
  const components = await discoverComponents();

  const drifted: string[] = [];
  for (const component of components) {
    const sidecar = sidecarPath(component.name, component.isExperimental);
    // Only components WITH a sidecar should import one.
    if (!existsSync(sidecar)) continue;
    const path = indexPath(component.name, component.isExperimental);
    if (!existsSync(path)) continue;
    const source = await Bun.file(path).text();
    const rewritten = withCssImport(source, component.name);
    if (rewritten === null) continue;
    drifted.push(path);
    if (!checkOnly) await Bun.write(path, rewritten);
  }

  if (checkOnly && drifted.length > 0) {
    process.stderr.write(
      `Source index CSS-import drift: ${drifted.length} entr(ies) missing their\n` +
        `leading \`import './<name>.css';\`. Run \`bun run scripts/prepend-source-index-css-import.ts\`:\n` +
        drifted.map((path) => `  ${path}`).join('\n') +
        '\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    checkOnly
      ? `Source index CSS-import: all ${components.length} components OK.\n`
      : `Source index CSS-import: rewrote ${drifted.length} entr(ies).\n`,
  );
}
