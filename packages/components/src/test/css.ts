/**
 * CSS test helpers. Internal — not part of the public package surface.
 */

import { parse, type AtRule } from 'postcss';

import { COMPONENT_LAYER_NAME } from '../../scripts/check-component-css.ts';

/**
 * Strip the outer `@layer cinder.components { … }` wrapper from a component CSS
 * sidecar, returning the inner rules as flat CSS.
 *
 * Component CSS files self-declare `@layer cinder.components { … }` so the layer
 * assignment survives a direct subpath import. happy-dom's CSS engine does NOT
 * apply rules nested inside a cascade-layer block to `getComputedStyle` or
 * expose them as top-level `CSSStyleRule`s in `sheet.cssRules`. Tests that
 * inject a sidecar into a `<style>` to assert on computed values or rule
 * structure therefore strip the wrapper first — they assert on the CSS the file
 * declares, not on layer cascade behavior (which happy-dom cannot model).
 *
 * Parsing is done with PostCSS (a real CSS tokenizer) rather than a hand-rolled
 * brace scan, so braces inside `content`, quoted strings, `url()`, or comments
 * cannot corrupt the result. Every `@layer cinder.components` block is unwrapped
 * (hoisting its children to the top level); content outside the wrapper and
 * wrappers with any other name are left untouched. Source with no such wrapper
 * is returned unchanged.
 */
export function stripCinderComponentsLayer(css: string): string {
  const root = parse(css);
  root.walkAtRules('layer', (atRule: AtRule) => {
    if (atRule.params.trim() !== COMPONENT_LAYER_NAME || atRule.nodes === undefined) return;
    atRule.replaceWith(atRule.nodes);
  });
  return root.toString();
}
