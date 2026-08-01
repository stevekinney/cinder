/**
 * Stylelint rule: cinder/z-index-scale.
 *
 * Global layers must use the public `--cinder-z-*` scale, and those references
 * deliberately have no inline fallback: tokens-base.css is the sole source of
 * truth. The only universally valid local stacking values are `auto`, `0`,
 * and `1`.
 *
 * A component may need a higher local layer (for example, a marker that must
 * paint above an overlapping focus ring). Keep that exceptional relationship
 * explicit by placing this comment immediately before the declaration:
 *
 *   /* cinder-z-index-local: <why this is local and needs a higher level>. *\/
 *   z-index: 2;
 *
 * The reason is attached to the declaration instead of a filename allow-list,
 * so refactors cannot silently transfer an unexplained exemption.
 */

import stylelint from 'stylelint';

import {
  bannedFallback,
  decodeCssEscapes,
  isStaticallyMagicNumber,
  isStaticallyNegative,
  protectCssSyntaxEscapes,
} from './z-index-value-analysis.mjs';

const ruleName = 'cinder/z-index-scale';
const localReasonPrefix = 'cinder-z-index-local:';
const layerTokenPattern = /^var\([\t\n\f\r ]*(--cinder-z-[a-z0-9-]+)[\t\n\f\r ]*\)$/i;
const layerTokenReferencePattern = /var\([\t\n\f\r ]*--cinder-z-[a-z0-9-]+[\t\n\f\r ]*,/i;
const declaredLayerTokens = new Set([
  '--cinder-z-backdrop',
  '--cinder-z-dropdown',
  '--cinder-z-drag-preview',
  '--cinder-z-focused-affordance',
  '--cinder-z-modal',
  '--cinder-z-popover',
  '--cinder-z-sheet',
  '--cinder-z-toast',
  '--cinder-z-tooltip',
]);
const allowedLocalValues = new Set(['auto', '0', '1']);

const messages = stylelint.utils.ruleMessages(ruleName, {
  fallback:
    'A `--cinder-z-*` token must not have a fallback; define the token once in tokens-base.css.',
  bannedFallback:
    'A `var()`, `env()`, or `attr()` fallback must not contain a banned z-index escape hatch.',
  invalid:
    '`z-index` must be `auto`, `0`, `1`, or a `--cinder-z-*` token without a fallback. ' +
    'Higher component-local values require an adjacent `cinder-z-index-local:` reason.',
});

const meta = {
  url: 'https://github.com/stevekinney/cinder/blob/main/docs/tokens.md#z-index-layers',
};

// Postcss keeps `/* ... */` comments embedded inside a raw declaration value
// instead of tokenizing them out, so `var(--cinder-z-popover/**/, 1100)` is a
// valid way to slip a forbidden fallback past a regex that only expects
// whitespace between the token and the comma. Strip comments before any
// pattern match runs so a CSS comment can never mask a fallback value.
function stripComments(value) {
  return value.replaceAll(/\/\*[\s\S]*?\*\//g, ' ');
}

function hasAdjacentLocalReason(declaration) {
  const previous = declaration.prev();
  if (previous?.type !== 'comment') return false;

  const text = previous.text.trim();
  if (!text.startsWith(localReasonPrefix)) return false;
  return text.slice(localReasonPrefix.length).trim().length > 0;
}

const plugin = stylelint.createPlugin(ruleName, (primary) => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true],
    });
    if (!validOptions) return;

    // This policy owns published component sidecars. Playground application
    // chrome and the separate Chat package have independent stacking systems.
    const sourceFile = root.source?.input.file?.replaceAll('\\', '/');
    if (
      sourceFile &&
      !sourceFile.includes('packages/components/src/components/') &&
      !sourceFile.includes('packages/components/src/styles/')
    )
      return;

    root.walkDecls((declaration) => {
      if (declaration.prop.toLowerCase() !== 'z-index') return;
      const rawValue = stripComments(declaration.value.trim()).trim();
      const value = decodeCssEscapes(protectCssSyntaxEscapes(rawValue));
      const tokenMatch = layerTokenPattern.exec(value);
      if (allowedLocalValues.has(value.toLowerCase())) return;
      if (tokenMatch) {
        if (declaredLayerTokens.has(tokenMatch[1])) return;
        stylelint.utils.report({ ruleName, result, node: declaration, message: messages.invalid });
        return;
      }

      if (layerTokenReferencePattern.test(value)) {
        stylelint.utils.report({
          ruleName,
          result,
          node: declaration,
          message: messages.fallback,
        });
        return;
      }

      const offendingFallback = bannedFallback(rawValue);
      if (offendingFallback) {
        const declarationText = declaration.toString();
        const normalizedDeclarationValue = declaration.value.trim();
        const declarationValueIndex = declarationText.indexOf(normalizedDeclarationValue);
        const fallbackIndex =
          offendingFallback.index === undefined ||
          normalizedDeclarationValue !== rawValue ||
          declarationValueIndex === -1
            ? -1
            : declarationValueIndex + offendingFallback.index;
        stylelint.utils.report({
          ruleName,
          result,
          node: declaration,
          ...(fallbackIndex >= 0
            ? { index: fallbackIndex, endIndex: fallbackIndex + offendingFallback.value.length }
            : {}),
          message: `${messages.bannedFallback} Offending fallback: \`${offendingFallback.value}\`.`,
        });
        return;
      }

      // The adjacent reason is the explicit, refactor-safe allow-list for
      // component-local relationships above the universal 0/1 threshold.
      // Never allow the historical magic escape hatch back, even with a note.
      const referencedTokens = [...value.matchAll(/var\([\t\n\f\r ]*(--cinder-z-[\w-]+)/g)].map(
        (match) => match[1],
      );
      if (referencedTokens.some((token) => !declaredLayerTokens.has(token))) {
        stylelint.utils.report({ ruleName, result, node: declaration, message: messages.invalid });
        return;
      }
      if (isStaticallyNegative(value)) {
        stylelint.utils.report({ ruleName, result, node: declaration, message: messages.invalid });
        return;
      }
      if (
        value !== '9999' &&
        !isStaticallyMagicNumber(value) &&
        hasAdjacentLocalReason(declaration)
      )
        return;

      stylelint.utils.report({
        ruleName,
        result,
        node: declaration,
        message: messages.invalid,
      });
    });
  };
});

plugin.ruleName = ruleName;
plugin.messages = messages;
plugin.meta = meta;

export default plugin;
