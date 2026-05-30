/**
 * CSS tree-shake invariants for the per-component `/styles` subpath model.
 *
 * The whole point of splitting `cinder/styles` into a slim base plus
 * per-component `cinder/<name>/styles` sidecars is that a consumer who imports
 * only one component's CSS does NOT ship every other component's rules. We
 * prove that by bundling a single component's source sidecar through Bun's CSS
 * bundler (the same machinery a downstream Vite/Bun consumer uses) and
 * asserting the output contains only that component's class names.
 *
 * We also pin the compound-parent behavior: importing a parent's sidecar pulls
 * in its leaf family via the sibling-leaf `@import` lines, while still
 * excluding unrelated components.
 */

import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

const componentsRoot = join(import.meta.dir, '..', 'components');
const scratchDirectory = join(import.meta.dir, '..', '..', '.css-tree-shake-scratch');

/**
 * Bundle a single component's source CSS sidecar and return the emitted CSS
 * text. Uses a unique scratch entry per call so parallel tests never collide.
 */
async function bundleComponentSidecar(name: string): Promise<string> {
  const sidecar = join(componentsRoot, name, `${name}.css`);
  const entry = join(scratchDirectory, `${name}-entry.css`);
  await Bun.write(entry, `@import '${sidecar}';\n`);
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: join(scratchDirectory, `${name}-out`),
    minify: false,
  });
  expect(result.success).toBe(true);
  const cssOutput = result.outputs.find((output) => output.path.endsWith('.css'));
  expect(cssOutput).toBeDefined();
  return cssOutput!.text();
}

afterAll(async () => {
  await rm(scratchDirectory, { recursive: true, force: true });
});

describe('per-component CSS tree-shaking', () => {
  test('a button-only bundle contains .cinder-button and NONE of .cinder-badge / .cinder-tabs', async () => {
    const css = await bundleComponentSidecar('button');
    expect(css).toContain('.cinder-button');
    expect(css).not.toContain('.cinder-badge');
    expect(css).not.toContain('.cinder-tabs');
  });

  test('a badge-only bundle contains .cinder-badge and not .cinder-button', async () => {
    const css = await bundleComponentSidecar('badge');
    expect(css).toContain('.cinder-badge');
    expect(css).not.toContain('.cinder-button');
  });

  test('every component sidecar self-declares the @layer cinder.components wrapper', async () => {
    const css = await bundleComponentSidecar('button');
    expect(css).toContain('@layer cinder.components');
  });
});

describe('compound-parent family aggregation', () => {
  test('an accordion-only bundle pulls the AccordionItem leaf but excludes unrelated components', async () => {
    const css = await bundleComponentSidecar('accordion');
    expect(css).toContain('.cinder-accordion');
    // Leaf pulled in via the sibling-leaf `@import '../accordion-item/...'`.
    expect(css).toContain('.cinder-accordion-item');
    expect(css).not.toContain('.cinder-badge');
    expect(css).not.toContain('.cinder-button');
  });

  test('a side-navigation-only bundle pulls the SideNavigationGroup leaf', async () => {
    const css = await bundleComponentSidecar('side-navigation');
    expect(css).toContain('.cinder-side-navigation');
    expect(css).toContain('.cinder-side-navigation-group');
    expect(css).not.toContain('.cinder-badge');
  });

  test('a tabs-only bundle excludes unrelated components', async () => {
    const css = await bundleComponentSidecar('tabs');
    expect(css).toContain('.cinder-tabs');
    expect(css).not.toContain('.cinder-badge');
    expect(css).not.toContain('.cinder-button');
  });
});

/**
 * Bundleability gate for the base stylesheets (`cinder/styles` and
 * `cinder/styles/all`). These are the files every consumer is instructed to
 * import first; if either has a CSS-spec violation (e.g. `@import` rules
 * preceded by a block-form `@layer`) the downstream Vite/Bun consumer build
 * will error. These tests run the same Lightning-CSS machinery that consumers
 * use to prove the files bundle cleanly.
 *
 * Regression guard: `@import` rules in CSS must precede all other rules except
 * `@charset` and statement-form `@layer`. A block-form `@layer { }` before an
 * `@import` is a spec violation that causes bundlers to drop the imports
 * entirely. These tests would have caught that defect before merge.
 */
describe('base stylesheet bundleability', () => {
  test('src/styles/index.css bundles cleanly (cinder/styles entry point)', async () => {
    const entry = join(import.meta.dir, 'index.css');
    const result = await Bun.build({
      entrypoints: [entry],
      outdir: join(scratchDirectory, 'index-css-out'),
      minify: false,
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      // Surface the actual error messages on failure so the fix is obvious.
      const messages = result.logs.map(String).join('\n');
      throw new Error(`index.css bundling failed:\n${messages}`);
    }
  });

  test('src/styles/all.css bundles cleanly (cinder/styles/all entry point)', async () => {
    const entry = join(import.meta.dir, 'all.css');
    const result = await Bun.build({
      entrypoints: [entry],
      outdir: join(scratchDirectory, 'all-css-out'),
      minify: false,
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      const messages = result.logs.map(String).join('\n');
      throw new Error(`all.css bundling failed:\n${messages}`);
    }
  });
});

/**
 * Marker presence invariants for the `--cinder-base-loaded` guard property.
 *
 * The guard in `cinder/styles/guard` reads this property to decide whether to
 * warn. It must be set by BOTH the slim base (`cinder/styles`) AND the all-in
 * aggregator (`cinder/styles/all`) so that all-in consumers do not get false-
 * positive warnings. It must NOT be set by `cinder/styles/tokens` alone, which
 * is independently exported and must not satisfy the guard unintentionally.
 */
describe('base-loaded marker coverage', () => {
  /**
   * Bundle a stylesheet entry point and return the emitted CSS text.
   * Uses a dedicated scratch output dir per call to avoid collisions.
   */
  async function bundleStylesheet(sourceFile: string, label: string): Promise<string> {
    const result = await Bun.build({
      entrypoints: [sourceFile],
      outdir: join(scratchDirectory, `marker-${label}-out`),
      minify: false,
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`${label} bundling failed:\n${result.logs.map(String).join('\n')}`);
    }
    const cssOutput = result.outputs.find((output) => output.path.endsWith('.css'));
    expect(cssOutput).toBeDefined();
    return cssOutput!.text();
  }

  test('cinder/styles (index.css) sets --cinder-base-loaded on :root', async () => {
    const css = await bundleStylesheet(join(import.meta.dir, 'index.css'), 'index');
    expect(css).toContain('--cinder-base-loaded');
  });

  test('cinder/styles/all (all.css) also sets --cinder-base-loaded on :root — no false-positive for all-in consumers', async () => {
    const css = await bundleStylesheet(join(import.meta.dir, 'all.css'), 'all');
    expect(css).toContain('--cinder-base-loaded');
  });

  test('cinder/styles/tokens (tokens.css alone) does NOT set --cinder-base-loaded — no false-negative guard bypass', async () => {
    const css = await bundleStylesheet(join(import.meta.dir, 'tokens.css'), 'tokens');
    expect(css).not.toContain('--cinder-base-loaded');
  });
});
