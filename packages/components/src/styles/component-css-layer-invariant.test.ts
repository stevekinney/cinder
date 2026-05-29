import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { parse } from 'postcss';

/**
 * Every component CSS file that reaches the cascade must carry its own
 * `@layer cinder.components { … }` wrapper so the layer assignment is intrinsic
 * to the file and survives a direct subpath import (`cinder/<name>/styles`),
 * rather than depending on the aggregator's `@import … layer(cinder.components)`.
 *
 * Without an intrinsic wrapper, a consumer importing a component's CSS directly
 * (or the `index.css` aggregator after it drops the `layer()` qualifier on
 * `components.css`) lands those rules OUTSIDE any cascade layer — the highest
 * priority — making them un-overridable by utilities or consumer styles. That
 * silently breaks the cascade contract.
 *
 * This asserts the structural invariant directly against the parsed CSS AST:
 * after ignoring comments, the only top-level node in each file is a single
 * `@layer cinder.components` block. No style-producing rule or at-rule may live
 * outside it.
 */

const repoRoot = join(import.meta.dir, '..', '..');

/**
 * CSS files that legitimately do NOT carry the wrapper, by exact path under the
 * package root. Anything else that lacks the wrapper is a leak and fails the
 * drift guard below.
 *
 * - `src/styles/components/experimental.css` is a pure `@import` aggregator;
 *   `@import` cannot live inside a block `@layer`, and its imported leaves each
 *   carry their own wrapper. It is never copied to `dist/`.
 * - `src/styles/components/experimental/_json-viewer-node.css` is an orphan: no
 *   `.css`/`.ts`/`.svelte` source imports it, so it never reaches the cascade.
 *   (The matching `_json-viewer-node.svelte` styles ship via `json-viewer.css`.)
 */
const UNWRAPPED_ALLOWLIST = new Set([
  'src/styles/components/experimental.css',
  'src/styles/components/experimental/_json-viewer-node.css',
]);

async function cssFilesUnder(directory: string): Promise<string[]> {
  const glob = new Bun.Glob(`${directory}/**/*.css`);
  const files: string[] = [];
  for await (const file of glob.scan(repoRoot)) {
    if (file.includes('.test.')) continue;
    files.push(file);
  }
  return files.toSorted();
}

/**
 * The full set of component CSS files subject to the wrapper invariant:
 * per-component sidecars under `src/components/` plus the shared partials under
 * `src/styles/components/`, minus the named allowlist of files that
 * legitimately stay unwrapped.
 */
async function wrappedCssFiles(): Promise<string[]> {
  const sidecars = await cssFilesUnder('src/components');
  const partials = await cssFilesUnder('src/styles/components');
  return [...sidecars, ...partials].filter((file) => !UNWRAPPED_ALLOWLIST.has(file)).toSorted();
}

function isSingleCinderComponentsLayer(source: string, file: string): boolean {
  const root = parse(source, { from: file });
  const topLevel = root.nodes.filter((node) => node.type !== 'comment');
  return (
    topLevel.length === 1 &&
    topLevel[0]?.type === 'atrule' &&
    topLevel[0].name === 'layer' &&
    topLevel[0].params.trim() === 'cinder.components'
  );
}

function describeShape(source: string, file: string): string {
  const root = parse(source, { from: file });
  return root.nodes
    .filter((node) => node.type !== 'comment')
    .map((node) =>
      node.type === 'atrule'
        ? `@${node.name} ${node.params}`.trim()
        : node.type === 'rule'
          ? node.selector
          : node.type,
    )
    .join(' | ');
}

describe('component CSS @layer invariant', () => {
  test('discovers a substantial set of component CSS files', async () => {
    const files = await wrappedCssFiles();
    expect(files.length).toBeGreaterThan(100);
  });

  test('every component CSS file wraps its rules in a single @layer cinder.components block', async () => {
    const files = await wrappedCssFiles();
    const offenders: string[] = [];

    for (const file of files) {
      const source = await Bun.file(join(repoRoot, file)).text();
      if (!isSingleCinderComponentsLayer(source, file)) {
        offenders.push(`${file} → ${describeShape(source, file)}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  test('the unwrapped allowlist stays minimal and accurate', async () => {
    // Guard against drift: the allowlist must name only files that exist and
    // are genuinely unwrapped. A stale entry (file deleted or later wrapped)
    // would silently hide a future leak, so we assert each entry is real and
    // still unwrapped.
    for (const file of UNWRAPPED_ALLOWLIST) {
      const handle = Bun.file(join(repoRoot, file));
      expect(await handle.exists()).toBe(true);
      const source = await handle.text();
      expect(isSingleCinderComponentsLayer(source, file)).toBe(false);
    }
  });
});

/**
 * The named-layer override regression test — the precise reason this wrapper
 * matters for direct subpath imports.
 *
 * A consumer that imports a component's CSS file DIRECTLY (e.g.
 * `cinder/badge/styles`, NOT `cinder/styles`) and then declares its own
 * `@layer app` override expects the documented cascade to hold:
 *
 *   @layer cinder.components, app;   ← app is declared AFTER cinder.components
 *   <direct import of badge.css>     ← rules join @layer cinder.components
 *   @layer app { .cinder-badge { … } } ← app wins by layer order
 *
 * This only works if the directly-imported file's rules are INSIDE
 * `@layer cinder.components`. Before this fix, `badge.css` held bare rules: a
 * direct import dropped them outside any layer, where they outrank every
 * layered rule and the `@layer app` override silently loses. We assert the
 * structural precondition for the override — every cascade-relevant component
 * rule lives in `cinder.components` — directly against the parsed AST, since a
 * real cascade resolution needs a browser and the layer membership is the only
 * thing this change controls.
 */
describe('direct-subpath layer override regression', () => {
  /**
   * Walk a parsed file and collect every style rule's enclosing top-level
   * layer name (or `null` when a rule sits outside any layer). `@keyframes`
   * stops are not document-targeting style rules, so they are skipped.
   */
  function topLevelLayerOfEveryRule(source: string, file: string): (string | null)[] {
    const root = parse(source, { from: file });
    const layers: (string | null)[] = [];

    const visit = (nodes: ReturnType<typeof parse>['nodes'], layer: string | null): void => {
      for (const node of nodes) {
        if (node.type === 'rule') {
          layers.push(layer);
        } else if (node.type === 'atrule') {
          const at = node;
          if (at.name === 'layer' && at.nodes) {
            visit(at.nodes, at.params.trim());
          } else if (/^(-\w+-)?keyframes$/i.test(at.name)) {
            // animation stops, not document-targeting rules
          } else if (at.nodes) {
            // @media / @supports / @container inherit the enclosing layer
            visit(at.nodes, layer);
          }
        }
      }
    };

    visit(root.nodes, null);
    return layers;
  }

  test('badge.css rules all live in @layer cinder.components (override precondition)', async () => {
    const source = await Bun.file(join(repoRoot, 'src/components/badge/badge.css')).text();
    const layers = topLevelLayerOfEveryRule(source, 'badge.css');

    expect(layers.length).toBeGreaterThan(0);
    // Not a single rule may sit outside the layer — that is the un-overridable
    // landmine this task removes.
    expect(layers.every((layer) => layer === 'cinder.components')).toBe(true);
  });

  test('a directly-imported partial (json-highlight.css) is fully layered', async () => {
    const source = await Bun.file(
      join(repoRoot, 'src/styles/components/json-highlight.css'),
    ).text();
    const layers = topLevelLayerOfEveryRule(source, 'json-highlight.css');

    expect(layers.length).toBeGreaterThan(0);
    expect(layers.every((layer) => layer === 'cinder.components')).toBe(true);
  });
});
