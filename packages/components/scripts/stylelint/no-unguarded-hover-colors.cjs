'use strict';

/**
 * Stylelint rule: cinder/no-unguarded-hover-colors
 *
 * Rejects :hover rules that change background or border color properties when
 * no ancestor @media (hover: hover) guard is present. The guard prevents
 * "sticky hover" on touch devices that synthesize :hover on tap.
 *
 * Conservative guard semantics: an ancestor @media must contain
 * `(hover: hover)`, must not contain a top-level comma (media list), and must
 * not contain a `not` modifier. Other conjunctive features are allowed.
 */

const stylelint = require('stylelint');
const selectorParser = require('postcss-selector-parser');

const ruleName = 'cinder/no-unguarded-hover-colors';

const messages = stylelint.utils.ruleMessages(ruleName, {
  unguarded: (selector, property) =>
    `Unguarded :hover rule "${selector}" declares "${property}". Wrap in @media (hover: hover) to avoid sticky hover on touch.`,
});

const meta = {
  url: 'https://github.com/stevekinney/cinder/blob/main/packages/components/scripts/stylelint/no-unguarded-hover-colors.cjs',
};

const TARGET_PROPERTIES = new Set([
  'background',
  'background-color',
  'background-image',
  'border',
  'border-color',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-block',
  'border-inline',
  'border-block-start',
  'border-block-end',
  'border-inline-start',
  'border-inline-end',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-block-color',
  'border-inline-color',
  'border-block-start-color',
  'border-block-end-color',
  'border-inline-start-color',
  'border-inline-end-color',
]);

/**
 * Walk a selector AST and return true if any selector branch contains a :hover
 * pseudo node — including pseudos nested inside :is(), :where(), :not(), etc.
 *
 * Each branch of a comma-separated selector list is evaluated independently:
 * a branch whose compound contains `::-webkit-scrollbar*` is excluded because
 * scrollbar pseudo-elements only render with a real pointer (touch devices
 * never paint custom scrollbar thumbs, so :hover there cannot synthesize a
 * sticky-tap state). A mixed selector list like
 *   `.foo:hover, .bar::-webkit-scrollbar-thumb:hover`
 * still triggers a warning for `.foo:hover` — only the scrollbar branch is
 * skipped.
 */
function selectorHasHover(selectorString) {
  let found = false;
  try {
    selectorParser((root) => {
      root.each((branch) => {
        let branchHasHover = false;
        let branchIsScrollbar = false;
        branch.walkPseudos((node) => {
          if (node.value === ':hover') {
            branchHasHover = true;
          }
          if (typeof node.value === 'string' && node.value.startsWith('::-webkit-scrollbar')) {
            branchIsScrollbar = true;
          }
        });
        if (branchHasHover && !branchIsScrollbar) {
          found = true;
        }
      });
    }).processSync(selectorString);
  } catch {
    // If the selector won't parse, fall back to a coarse text check that
    // applies the same per-branch exclusion.
    return selectorString
      .split(',')
      .some((branch) => /:hover\b/.test(branch) && !/::-webkit-scrollbar/.test(branch));
  }
  return found;
}

/**
 * Conservative hover-guard predicate. Accepts only single, non-negated media
 * queries that contain (hover: hover). Comma-separated media lists are
 * rejected because any branch without (hover: hover) can activate on touch.
 */
function isHoverGuard(params) {
  if (!params) return false;
  if (params.includes(',')) return false;
  if (/\bnot\b/i.test(params)) return false;
  return /\(\s*hover\s*:\s*hover\s*\)/i.test(params);
}

function hasGuardingAncestor(rule) {
  let parent = rule.parent;
  while (parent) {
    if (parent.type === 'atrule' && parent.name === 'media' && isHoverGuard(parent.params)) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

const ruleFunction = (primary, _secondaryOptions, context) => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true, false],
    });
    if (!validOptions || !primary) return;

    root.walkRules((rule) => {
      // Skip rules that live inside @keyframes or other non-style at-rules
      // where :hover is meaningless.
      if (!selectorHasHover(rule.selector)) return;
      if (hasGuardingAncestor(rule)) return;

      rule.walkDecls((decl) => {
        const property = decl.prop.toLowerCase();
        if (!TARGET_PROPERTIES.has(property)) return;

        stylelint.utils.report({
          message: messages.unguarded(rule.selector, property),
          node: decl,
          result,
          ruleName,
        });
      });
    });
  };
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = meta;

module.exports = stylelint.createPlugin(ruleName, ruleFunction);
