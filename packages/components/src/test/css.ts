/**
 * CSS test helpers. Internal — not part of the public package surface.
 */

/**
 * Strip a single outer `@layer cinder.components { … }` wrapper from a component
 * CSS sidecar, returning the inner rule text.
 *
 * Component CSS files self-declare `@layer cinder.components { … }` so the layer
 * assignment survives a direct subpath import. happy-dom's CSS engine does NOT
 * apply rules nested inside a cascade-layer block to `getComputedStyle` or
 * expose them as top-level `CSSStyleRule`s in `sheet.cssRules`. Tests that
 * inject a sidecar into a `<style>` to assert on computed values or rule
 * structure therefore strip the wrapper first — they assert on the CSS the file
 * declares, not on layer cascade behavior (which happy-dom cannot model).
 *
 * If the source has no `@layer cinder.components` wrapper, it is returned
 * unchanged.
 */
export function stripCinderComponentsLayer(css: string): string {
  const open = /@layer\s+cinder\.components\s*\{/.exec(css);
  if (!open) return css;

  const bodyStart = open.index + open[0].length;

  // Find the matching closing brace for the wrapper by tracking brace depth.
  let depth = 1;
  let index = bodyStart;
  for (; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }

  const before = css.slice(0, open.index);
  const inner = css.slice(bodyStart, index);
  const after = css.slice(index + 1);
  return `${before}${inner}${after}`;
}
