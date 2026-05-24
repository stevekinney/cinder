/**
 * Shared helpers for the focus-visible policy enforcement layers.
 *
 * Two callers consume these helpers:
 *
 * 1. `no-focus-visible-colored-outline.mjs` — Stylelint plugin that rejects
 *    colored outline channels in non-forced-colors `:focus-visible` rules.
 * 2. `packages/components/src/test/focus-ring-recipe.test.ts` — parser-based
 *    regression test that pins the `box-shadow` half of Strategy B on the
 *    specific selectors this task realigned.
 *
 * Both layers walk PostCSS nodes and need to answer "is this rule nested
 * under `@media (forced-colors: active)`?" identically. Keeping the logic in
 * one place means a future change to forced-colors detection (e.g., handling
 * `@supports`-nested fallbacks, or `(prefers-contrast: more)`) propagates to
 * both places without drift.
 *
 * Authored as ESM (.mjs) because the Stylelint plugin is loaded through
 * Node's module resolver, not Bun's, and Stylelint plugins cannot import
 * `.ts` files.
 */

/**
 * Matches a single CSS media-query branch that contains the
 * `(forced-colors: active)` feature. Used both as a per-branch check (when
 * walking comma-separated query lists) and as a full-params match.
 */
export const FORCED_COLORS_FEATURE = /\(\s*forced-colors\s*:\s*active\s*\)/i;

/**
 * Return every `@media` query string in the ancestor chain of `node`,
 * outermost first. Non-media at-rules (e.g., `@supports`, `@layer`) are
 * ignored — only media queries are relevant to forced-colors detection.
 */
export function ancestorMediaQueries(node) {
  const queries = [];
  let current = node.parent;
  while (current) {
    if (current.type === 'atrule' && current.name && current.name.toLowerCase() === 'media') {
      queries.push(current.params);
    }
    current = current.parent;
  }
  return queries;
}

/**
 * Is `node` nested inside an `@media` query that gates only on
 * `(forced-colors: active)`? The check walks every ancestor `@media`; if
 * any one of them has all comma-separated branches matching
 * `(forced-colors: active)`, the rule is treated as a forced-colors
 * fallback even if it also sits inside an unrelated outer query like
 * `@media (hover: hover)`. A comma-separated query that mixes
 * forced-colors with another feature (e.g. `(forced-colors: active),
 * (hover: hover)`) is intentionally NOT treated as a fallback — the
 * non-forced branch would still apply the rule's declarations to ordinary
 * viewports and let a colored outline slip through.
 */
export function isUnderForcedColors(node) {
  const queries = ancestorMediaQueries(node);
  if (queries.length === 0) return false;
  return queries.some((params) => {
    const branches = params.split(',');
    return branches.every((branch) => FORCED_COLORS_FEATURE.test(branch));
  });
}
