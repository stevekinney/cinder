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
