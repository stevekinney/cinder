/**
 * Stylelint rule: cinder/require-forced-colors-focus-fallback.
 *
 * A `:focus-visible` rule that relies on `box-shadow` for its visible ring
 * is invisible in Windows High Contrast Mode (forced-colors), because user
 * agents are permitted to remove box-shadows in that mode. This rule reports
 * an error when a `:focus-visible` selector uses `box-shadow` but has no
 * matching `@media (forced-colors: active)` block in the same file that
 * repaints the outline for that selector.
 *
 * The check is selector-exact: a forced-colors block for `.x:focus-visible`
 * does NOT exempt `.y:focus-visible` even if they appear in the same rule.
 * This prevents accidental "cover" from a broad selector masking a gap on a
 * specific one.
 *
 * Authored as ESM (.mjs) because Stylelint loads plugins via Node's module
 * resolver, not Bun's.
 */

import stylelint from 'stylelint';

import { isUnderForcedColors } from './focus-ring-helpers.mjs';

const ruleName = 'cinder/require-forced-colors-focus-fallback';

const messages = stylelint.utils.ruleMessages(ruleName, {
  missingFallback: (selector) =>
    'The `:focus-visible` selector `' +
    String(selector) +
    '` uses `box-shadow` for its focus ring but has no matching ' +
    '`@media (forced-colors: active)` block with a non-transparent `outline`. ' +
    'Add a forced-colors fallback so keyboard focus is visible in Windows ' +
    'High Contrast Mode. See docs/focus-ring-policy.md.',
});

const meta = {
  url: 'https://github.com/stevekinney/cinder/blob/main/docs/focus-ring-policy.md',
};

function selectorMatchesFocusVisible(selector) {
  return /:focus-visible(?![\w-])/.test(selector);
}

/**
 * Normalize a selector string for comparison: collapse runs of whitespace
 * so that selectors split across multiple lines compare equal to their
 * single-line equivalents.
 */
function normalizeSelector(selector) {
  return selector.replace(/\s+/g, ' ').trim();
}

const plugin = stylelint.createPlugin(ruleName, (primary) => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true],
    });
    if (!validOptions) return;

    // Pass 1: collect every :focus-visible selector that uses box-shadow
    // outside forced-colors mode.
    /** @type {Map<string, import('postcss').Rule>} normalized-selector → first Rule node */
    const boxShadowFocusSelectors = new Map();

    root.walkRules((rule) => {
      if (isUnderForcedColors(rule)) return;
      if (!rule.selectors.some((s) => selectorMatchesFocusVisible(s))) return;

      let hasBoxShadow = false;
      rule.walkDecls('box-shadow', () => {
        hasBoxShadow = true;
      });
      if (!hasBoxShadow) return;

      for (const selector of rule.selectors) {
        if (!selectorMatchesFocusVisible(selector)) continue;
        const normalized = normalizeSelector(selector);
        if (!boxShadowFocusSelectors.has(normalized)) {
          boxShadowFocusSelectors.set(normalized, rule);
        }
      }
    });

    if (boxShadowFocusSelectors.size === 0) return;

    // Pass 2: collect every :focus-visible selector that has a non-transparent
    // outline inside a forced-colors block.
    /** @type {Set<string>} normalized selectors with a valid forced-colors fallback */
    const coveredSelectors = new Set();

    root.walkRules((rule) => {
      if (!isUnderForcedColors(rule)) return;
      if (!rule.selectors.some((s) => selectorMatchesFocusVisible(s))) return;

      let hasNonTransparentOutline = false;
      rule.walkDecls('outline', (decl) => {
        if (!decl.value.toLowerCase().includes('transparent')) {
          hasNonTransparentOutline = true;
        }
      });
      if (!hasNonTransparentOutline) return;

      for (const selector of rule.selectors) {
        if (!selectorMatchesFocusVisible(selector)) continue;
        coveredSelectors.add(normalizeSelector(selector));
      }
    });

    // Report any box-shadow focus selector that has no forced-colors cover.
    for (const [normalized, ruleNode] of boxShadowFocusSelectors) {
      if (!coveredSelectors.has(normalized)) {
        stylelint.utils.report({
          ruleName,
          result,
          node: ruleNode,
          message: messages.missingFallback(normalized),
        });
      }
    }
  };
});

plugin.ruleName = ruleName;
plugin.messages = messages;
plugin.meta = meta;

export default plugin;
