import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { parse, type ChildNode } from 'postcss';

import { COMPONENT_LAYER_NAME, isSingleComponentLayer } from '../../scripts/check-component-css.ts';

/**
 * Every component CSS file that reaches the cascade must carry its own
 * `@layer cinder.components { … }` wrapper so the layer assignment is intrinsic
 * to the file and survives a direct subpath import (`@lostgradient/cinder/<name>/styles`),
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
 * outside it. The shape check is shared with the build gate
 * (`isSingleComponentLayer` in `check-component-css.ts`) so both agree.
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

async function scanGlob(pattern: string): Promise<string[]> {
  const glob = new Bun.Glob(pattern);
  const files: string[] = [];
  for await (const file of glob.scan(repoRoot)) {
    if (file.includes('.test.')) continue;
    files.push(file);
  }
  return files;
}

/**
 * CSS files imported DIRECTLY by component source (`import './foo.css'` in a
 * `.svelte` or `.ts`) rather than through the `@lostgradient/cinder/styles` aggregator. These
 * still reach a consumer's cascade, so they are subject to the same invariant.
 * `markdown-editor.svelte` imports `prosemirror.css` this way — it lives under
 * `src/components/` so the glob already covers it, but enumerating the import
 * graph keeps the guard honest if such a file ever lands outside that root.
 */
async function directlyImportedComponentCss(): Promise<string[]> {
  const sources = await scanGlob('src/components/**/*.{svelte,ts}');
  const importPattern = /import\s+['"](\.[^'"]+\.css)['"]/g;
  const found = new Set<string>();
  for (const source of sources) {
    const absolute = join(repoRoot, source);
    const text = await Bun.file(absolute).text();
    for (const match of text.matchAll(importPattern)) {
      // Resolve the relative specifier against the importing file's directory,
      // then re-express it relative to the package root for comparison.
      const resolved = join(source, '..', match[1]!);
      found.add(resolved);
    }
  }
  return [...found];
}

/**
 * The full set of component CSS files subject to the wrapper invariant:
 * per-component sidecars under `src/components/`, the shared partials under
 * `src/styles/components/`, and any CSS imported directly by component source —
 * minus the named allowlist of files that legitimately stay unwrapped.
 */
async function wrappedCssFiles(): Promise<string[]> {
  const sidecars = await scanGlob('src/components/**/*.css');
  const partials = await scanGlob('src/styles/components/**/*.css');
  const directImports = await directlyImportedComponentCss();
  const union = new Set([...sidecars, ...partials, ...directImports]);
  return [...union].filter((file) => !UNWRAPPED_ALLOWLIST.has(file)).toSorted();
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

async function isWrapped(file: string): Promise<boolean> {
  const source = await Bun.file(join(repoRoot, file)).text();
  return isSingleComponentLayer(parse(source, { from: file }));
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
      if (!(await isWrapped(file))) {
        const source = await Bun.file(join(repoRoot, file)).text();
        offenders.push(`${file} → ${describeShape(source, file)}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  test('directly-imported component CSS (e.g. prosemirror.css) is enumerated and wrapped', async () => {
    // Codex flagged that CSS imported by a component's source — not via the
    // aggregator — could be a coverage hole. Assert the discovery actually finds
    // such a file so this guard cannot silently degrade to "found nothing".
    const directImports = await directlyImportedComponentCss();
    expect(directImports).toContain('src/components/markdown-editor/prosemirror.css');
    expect(await isWrapped('src/components/markdown-editor/prosemirror.css')).toBe(true);
  });

  test('the unwrapped allowlist stays minimal and accurate', async () => {
    // Guard against drift: the allowlist must name only files that exist and
    // are genuinely unwrapped. A stale entry (file deleted or later wrapped)
    // would silently hide a future leak, so we assert each entry is real and
    // still unwrapped.
    for (const file of UNWRAPPED_ALLOWLIST) {
      const handle = Bun.file(join(repoRoot, file));
      expect(await handle.exists()).toBe(true);
      expect(await isWrapped(file)).toBe(false);
    }
  });
});

/**
 * Layer-membership regression for direct subpath imports.
 *
 * This is the structural precondition for the documented override behavior: a
 * consumer that imports a component's CSS file DIRECTLY (e.g. `@lostgradient/cinder/badge/styles`,
 * NOT `@lostgradient/cinder/styles`) and declares its own `@layer app` override after
 * `@layer cinder.components, app;` expects `@layer app` to win. That only holds
 * if the directly-imported file's rules are INSIDE `@layer cinder.components`.
 * Before this fix, `badge.css` held bare rules: a direct import dropped them
 * outside any layer, where they outrank every layered rule and the override
 * silently loses.
 *
 * This asserts MEMBERSHIP (every cascade-relevant rule lives in
 * `cinder.components`) against the parsed AST — NOT real cascade resolution,
 * which needs a browser. Layer membership is the only thing this change
 * controls; the named-layer ordering remains the consumer's responsibility.
 */
describe('direct-subpath layer membership regression', () => {
  /**
   * Walk a parsed file and collect every style rule's enclosing top-level
   * layer name (or `null` when a rule sits outside any layer). `@keyframes`
   * stops are not document-targeting style rules, so they are skipped.
   */
  function topLevelLayerOfEveryRule(source: string, file: string): (string | null)[] {
    const root = parse(source, { from: file });
    const layers: (string | null)[] = [];

    const visit = (nodes: ChildNode[], layer: string | null): void => {
      for (const node of nodes) {
        if (node.type === 'rule') {
          layers.push(layer);
        } else if (node.type === 'atrule') {
          if (node.name === 'layer' && node.nodes) {
            visit(node.nodes, node.params.trim());
          } else if (/^(-\w+-)?keyframes$/i.test(node.name)) {
            // animation stops, not document-targeting rules
          } else if (node.nodes) {
            // @media / @supports / @container inherit the enclosing layer
            visit(node.nodes, layer);
          }
        }
      }
    };

    visit(root.nodes, null);
    return layers;
  }

  async function assertEveryRuleInComponentLayer(file: string): Promise<void> {
    const source = await Bun.file(join(repoRoot, file)).text();
    const layers = topLevelLayerOfEveryRule(source, file);
    expect(layers.length).toBeGreaterThan(0);
    // Not a single rule may sit outside the layer — that is the un-overridable
    // landmine this task removes.
    expect(layers.every((layer) => layer === COMPONENT_LAYER_NAME)).toBe(true);
  }

  test('badge.css rules all live in @layer cinder.components (override precondition)', async () => {
    await assertEveryRuleInComponentLayer('src/components/badge/badge.css');
  });

  test('a directly-imported partial (json-highlight.css) is fully layered', async () => {
    await assertEveryRuleInComponentLayer('src/styles/components/json-highlight.css');
  });
});
