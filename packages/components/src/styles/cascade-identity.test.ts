import { dirname, join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { parse, type ChildNode } from 'postcss';

import { COMPONENT_LAYER_NAME } from '../../scripts/check-component-css.ts';

/**
 * Cascade-identity guard for the aggregated `cinder/styles` entry point.
 *
 * Wrapping every component CSS file in `@layer cinder.components { … }` and
 * dropping the `layer(cinder.components)` qualifier from `index.css`'s
 * `components.css` import is meant to be cascade-NEUTRAL for the aggregated
 * path: the layer membership moves from the `@import` to the file itself, but
 * each rule must still resolve into the same layer, in the same source order.
 *
 * "Renders unchanged" reduces to that structural contract. This test makes it
 * reproducible and a permanent regression guard by resolving the full `@import`
 * tree into a flat, ordered (layer, selector) stream and asserting:
 *
 *   1. The four cascade layers, as seen through `index.css`, resolve in the
 *      declared order (`cinder.tokens` → `cinder.foundation` →
 *      `cinder.components` → `cinder.utilities`).
 *   2. EVERY rule reachable through the `components.css` aggregator resolves
 *      into `cinder.components` — never `null` (outside any layer: the
 *      un-overridable landmine this change removes) and never a nested or
 *      mis-named layer.
 *
 * It deliberately does NOT pin exact selector text (that is the component
 * authors' churn surface); it pins the cascade SHAPE, which is what a layering
 * refactor must preserve. Note that `.cinder-*` selectors also legitimately
 * appear in `cinder.foundation` and `cinder.utilities` (e.g. `.cinder-sr-only`),
 * so the component-surface set is defined by REACHABILITY through
 * `components.css`, not by selector prefix.
 */

const stylesRoot = import.meta.dir;
const indexCss = join(stylesRoot, 'index.css');
const componentsCss = join(stylesRoot, 'components.css');

type FlatRule = { layer: string | null; selector: string };

/** Resolve an `@import` specifier (and any `layer()` qualifier) relative to the importing file. */
function resolveImport(
  fromFile: string,
  params: string,
): { target: string; layer: string | undefined } | null {
  const match = params.match(/['"]([^'"]+)['"]\s*(?:layer\(([^)]*)\))?/);
  if (!match) return null;
  return { target: join(dirname(fromFile), match[1]!), layer: match[2]?.trim() };
}

/**
 * Recursively inline the `@import` tree rooted at `file`, tracking the active
 * cascade-layer path, and return every style rule as `{ layer, selector }` in
 * source order. `@keyframes` stops are skipped; `@media`/`@supports`/`@container`
 * inherit the enclosing layer.
 */
async function flattenCascade(
  file: string,
  parentLayer: string | null = null,
): Promise<FlatRule[]> {
  const out: FlatRule[] = [];
  const root = parse(await Bun.file(file).text(), { from: file });

  const walk = async (nodes: ChildNode[], layer: string | null): Promise<void> => {
    for (const node of nodes) {
      if (node.type === 'rule') {
        out.push({ layer, selector: node.selector.replace(/\s+/g, ' ').trim() });
      } else if (node.type === 'atrule') {
        const at = node;
        if (at.name === 'import') {
          const resolved = resolveImport(file, at.params);
          if (!resolved) continue;
          const nextLayer = resolved.layer
            ? layer
              ? `${layer}.${resolved.layer}`
              : resolved.layer
            : layer;
          out.push(...(await flattenCascade(resolved.target, nextLayer)));
        } else if (at.name === 'layer' && at.nodes) {
          const name = at.params.trim();
          await walk(at.nodes, layer ? `${layer}.${name}` : name);
        } else if (/^(-\w+-)?keyframes$/i.test(at.name)) {
          // animation stops, not document-targeting rules — skip
        } else if (at.nodes) {
          await walk(at.nodes, layer);
        }
      }
    }
  };

  await walk(root.nodes, parentLayer);
  return out;
}

describe('cascade identity (aggregated cinder/styles)', () => {
  test('the four cascade layers resolve in declared order through index.css', async () => {
    const stream = await flattenCascade(indexCss);
    const order: string[] = [];
    for (const { layer } of stream) {
      if (layer && layer !== order[order.length - 1]) order.push(layer);
    }
    expect(order).toEqual([
      'cinder.tokens',
      'cinder.foundation',
      COMPONENT_LAYER_NAME,
      'cinder.utilities',
    ]);
  });

  test('every rule reachable through components.css resolves into cinder.components', async () => {
    // Flatten `components.css` on its own (no enclosing layer, exactly as
    // `index.css` now imports it). Each rule must carry the intrinsic
    // `@layer cinder.components` membership — none may land at `null` (outside
    // any layer) or in a nested/mis-named layer.
    const stream = await flattenCascade(componentsCss);
    expect(stream.length).toBeGreaterThan(100);

    const offenders = stream.filter(({ layer }) => layer !== COMPONENT_LAYER_NAME);
    expect(offenders).toEqual([]);
  }, 10_000);
});
