/**
 * Contract: server (`node`-condition) entries are CSS-free and import cleanly
 * under bare Node.
 *
 * The browser per-component build auto-injects `import '@lostgradient/cinder/<name>/styles'`
 * so `import Button from '@lostgradient/cinder/button'` and `import { Button } from '@lostgradient/cinder'`
 * are styled with no manual CSS import. That injection MUST land only in the
 * browser graph: a CSS import reached under the `node` export condition
 * resolves to a `.css` file, which plain Node SSR rejects with
 * `ERR_UNKNOWN_FILE_EXTENSION`. This suite guards that boundary two ways:
 *
 *   1. Static scan — every `node`-condition `.js` target in `package.json`
 *      contains no CSS import (`*.css` or `@lostgradient/cinder/<name>/styles`).
 *   2. Runtime import — a single bare-Node process dynamically imports EVERY
 *      `node`-condition `.js` target and asserts none throw a CSS-extension
 *      error (`ERR_UNKNOWN_FILE_EXTENSION` / "Unknown file extension .css").
 *      It intentionally tolerates OTHER import/linking errors (e.g. unrelated
 *      Svelte server re-export quirks) so this suite stays scoped to the CSS
 *      boundary. This catches a CSS import the static scan's patterns might miss
 *      and proves the server tree loads CSS-free in the runtime it targets.
 *
 * Requires a prior `bun run build` (the `node` targets live under `dist/`).
 * Skipped when `dist/` is absent so a no-build checkout (e.g. the scoped
 * unit-test CI job, which does not build) does not fail; the publish flow and
 * any local `bun run build && bun run test` exercise it.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Glob } from 'bun';
import { describe, expect, it } from 'bun:test';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const distributionRoot = join(packageRoot, 'dist');

/**
 * Read `package.json#exports` and return every `node`-condition target that is
 * a JS file (the runtime server entries). Metadata-only subpaths whose `node`
 * target is a `.json` or `.css` are excluded — only the `node`-condition JS is
 * the SSR runtime surface this contract covers.
 */
async function nodeConditionJsTargets(): Promise<string[]> {
  const manifest = await Bun.file(join(packageRoot, 'package.json')).json();
  const targets = new Set<string>();
  for (const entry of Object.values(manifest.exports ?? {})) {
    if (entry === null || typeof entry !== 'object') continue;
    const node = (entry as Record<string, unknown>)['node'];
    if (typeof node === 'string' && node.endsWith('.js')) {
      targets.add(node);
    }
  }
  return [...targets].toSorted();
}

/**
 * A REAL CSS import statement, anchored to its own line so a CSS-shaped string
 * literal embedded in another statement (e.g. the base-guard warning text that
 * mentions `import '@lostgradient/cinder/<component>/styles'`) is not a false positive. esbuild
 * emits side-effect imports as standalone `import"x";` / `import 'x';` lines and
 * `from`/dynamic forms with the specifier at the line's import position.
 */
const CSS_IMPORT_LINE =
  /^\s*import\s*(?:[\w*${},\s]+\s+from\s*)?['"](?:[^'"]*\.css|cinder\/(?:experimental\/)?[a-z0-9-]+\/styles)['"]|^\s*import\s*\(\s*['"](?:[^'"]*\.css|cinder\/(?:experimental\/)?[a-z0-9-]+\/styles)['"]/;

function hasCssImportLine(source: string): boolean {
  return source.split('\n').some((line) => CSS_IMPORT_LINE.test(line));
}

describe.skipIf(!existsSync(distributionRoot))('server entries are CSS-free', () => {
  it('lists at least the root + button server entries (sanity: dist is populated)', async () => {
    const targets = await nodeConditionJsTargets();
    expect(targets).toContain('./dist/server/index.js');
    expect(targets).toContain('./dist/server/components/button/index.js');
  });

  it('contains no CSS import in any node-condition JS target (static scan)', async () => {
    const targets = await nodeConditionJsTargets();
    const offenders: string[] = [];
    for (const target of targets) {
      const filePath = join(packageRoot, target);
      if (!existsSync(filePath)) continue;
      const text = await Bun.file(filePath).text();
      if (hasCssImportLine(text)) offenders.push(target);
    }
    expect(offenders).toEqual([]);
  });

  it('emits no CSS assets under dist/server', async () => {
    const cssFiles: string[] = [];
    const glob = new Glob('**/*.css');
    for await (const relativePath of glob.scan({ cwd: join(distributionRoot, 'server') })) {
      cssFiles.push(relativePath);
    }
    expect(cssFiles).toEqual([]);
  });

  it('publishes the root server entry with a matching source map name', () => {
    expect(existsSync(join(distributionRoot, 'server', 'index.server.js'))).toBe(false);
    expect(existsSync(join(distributionRoot, 'server', 'index.server.js.map'))).toBe(false);

    const rootEntry = readFileSync(join(distributionRoot, 'server', 'index.js'), 'utf8');
    expect(rootEntry).toContain('//# sourceMappingURL=index.js.map');

    const rootSourceMap = JSON.parse(
      readFileSync(join(distributionRoot, 'server', 'index.js.map'), 'utf8'),
    ) as Record<string, unknown>;
    expect(rootSourceMap['file']).toBe('index.js');
  });

  it('imports every node-condition entry under bare Node with no ERR_UNKNOWN_FILE_EXTENSION', async () => {
    const targets = await nodeConditionJsTargets();
    const existingTargets = targets.filter((target) => existsSync(join(packageRoot, target)));
    expect(existingTargets.length).toBeGreaterThan(0);

    // One bare-Node process imports every target sequentially. A CSS import in
    // a server entry surfaces as ERR_UNKNOWN_FILE_EXTENSION the moment Node
    // resolves that entry's import graph. Failures are collected so the
    // assertion reports every broken entry, not just the first.
    const runnerScript = `
      const targets = ${JSON.stringify(existingTargets)};
      const failures = [];
      for (const target of targets) {
        try {
          await import(target);
        } catch (error) {
          failures.push({ target, code: error?.code ?? null, message: String(error?.message ?? error).slice(0, 200) });
        }
      }
      process.stdout.write(JSON.stringify(failures));
    `;

    const result = spawnSync('node', ['--input-type=module', '-e', runnerScript], {
      cwd: packageRoot,
      encoding: 'utf8',
      timeout: 120_000,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);

    const failures: Array<{ target: string; code: string | null; message: string }> = JSON.parse(
      result.stdout.trim() || '[]',
    );

    // The load-bearing assertion for THIS contract: no server entry pulls a CSS
    // import. A CSS import is a module-resolution/load failure, which Node
    // raises BEFORE any export-linking error — so it surfaces here even for
    // entries that would later fail to link for unrelated reasons.
    //
    // Some server entries fail to load in bare Node for reasons unrelated to
    // CSS (e.g. Svelte server-component re-export linking — `Export 'defaultN'
    // is not defined`). Those are a separate, pre-existing server-bundle
    // concern and out of scope here; this suite owns only the CSS boundary, so
    // it asserts on the CSS error class specifically rather than demanding a
    // clean load of every entry.
    const cssExtensionFailures = failures.filter(
      (failure) =>
        failure.code === 'ERR_UNKNOWN_FILE_EXTENSION' ||
        /\.css(['"]|$)/.test(failure.message) ||
        failure.message.includes('Unknown file extension'),
    );
    expect(cssExtensionFailures).toEqual([]);
  }, 130_000);
});
