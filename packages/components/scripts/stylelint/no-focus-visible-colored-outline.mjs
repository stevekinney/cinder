/**
 * Stylelint rule: cinder/no-focus-visible-colored-outline.
 *
 * Cinder's focus-visible recipe is a transparent placeholder outline plus a
 * shared box-shadow (see docs/focus-ring-policy.md). This rule rejects any
 * colored outline channel inside a non-forced-colors `:focus-visible` rule so
 * the recipe can't drift back to per-component variants. Forced-colors
 * fallbacks are exempt because `box-shadow` is suppressed in High Contrast
 * Mode and the outline must repaint with a system color.
 *
 * Authored as ESM (.mjs) because Stylelint loads plugins via Node's module
 * resolver, not Bun's. The companion test file (.test.ts) covers both this
 * rule's direct invocations and the rule loaded through `.stylelintrc.json`.
 */

import stylelint from 'stylelint';

import { isUnderForcedColors } from './focus-ring-helpers.mjs';

const ruleName = 'cinder/no-focus-visible-colored-outline';

const messages = stylelint.utils.ruleMessages(ruleName, {
  coloredOutline: (property, value) =>
    'Unexpected colored `' +
    String(property) +
    ': ' +
    String(value) +
    '` inside :focus-visible. Use ' +
    '`outline: var(--cinder-ring-width) solid transparent;` paired with ' +
    '`box-shadow: var(--_cinder-focus-ring-shadow);` instead. ' +
    'See docs/focus-ring-policy.md.',
  longhandOutline: (property) =>
    'Unexpected `' +
    String(property) +
    '` inside :focus-visible. A colored outline channel ' +
    'cannot be reconstructed longhand — use the shared transparent-outline + ' +
    'box-shadow recipe instead. See docs/focus-ring-policy.md.',
  outlineNone: () =>
    'Unexpected `outline: none` inside :focus-visible. Parent-owned focus ' +
    'rings must annotate this exception with a `/* cinder-focus-ring-owner: parent */` ' +
    'comment on the preceding line.',
});

const meta = {
  url: 'https://github.com/stevekinney/cinder/blob/main/docs/focus-ring-policy.md',
};

/**
 * Match any `outline: <width> solid transparent` shape. The width may be the
 * canonical `var(--cinder-ring-width)` token, a token with a fallback, or a
 * pixel literal — what matters is that the visible color is `transparent` so
 * the channel exists as a forced-colors placeholder and the visible ring lives
 * in `box-shadow`. The `--cinder-ring-width` token is preferred (see
 * docs/focus-ring-policy.md § Token Reference) and is enforced separately by
 * the parser-based recipe tests on this task's affected selectors.
 */
const TRANSPARENT_OUTLINE_PATTERN = /^\S[\s\S]*\s+solid\s+transparent$/i;

const OWNER_COMMENT_PATTERN = /cinder-focus-ring-owner\s*:\s*parent/i;

function selectorMatchesFocusVisible(selector) {
  return /:focus-visible(?![\w-])/.test(selector);
}

function hasOwnerComment(decl) {
  let prev = decl.prev();
  while (prev) {
    if (prev.type === 'comment') {
      if (OWNER_COMMENT_PATTERN.test(prev.text)) return true;
      prev = prev.prev();
      continue;
    }
    break;
  }
  return false;
}

const plugin = stylelint.createPlugin(ruleName, (primary) => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true],
    });
    if (!validOptions) return;

    root.walkRules((rule) => {
      if (!selectorMatchesFocusVisible(rule.selector)) return;
      if (isUnderForcedColors(rule)) return;

      rule.walkDecls((decl) => {
        const prop = decl.prop.toLowerCase();
        if (prop !== 'outline' && !prop.startsWith('outline-')) return;

        if (prop === 'outline-offset') return;

        if (prop === 'outline-color' || prop === 'outline-style' || prop === 'outline-width') {
          stylelint.utils.report({
            ruleName,
            result,
            node: decl,
            message: messages.longhandOutline(prop),
          });
          return;
        }

        if (prop === 'outline') {
          const value = decl.value.trim();
          if (value.toLowerCase() === 'none') {
            if (hasOwnerComment(decl)) return;
            stylelint.utils.report({
              ruleName,
              result,
              node: decl,
              message: messages.outlineNone(),
            });
            return;
          }
          if (TRANSPARENT_OUTLINE_PATTERN.test(value)) return;
          stylelint.utils.report({
            ruleName,
            result,
            node: decl,
            message: messages.coloredOutline(prop, value),
          });
        }
      });
    });
  };
});

plugin.ruleName = ruleName;
plugin.messages = messages;
plugin.meta = meta;

export default plugin;
