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

import { bannedFallback } from './z-index-fallback-analysis.mjs';
import {
  cssCommentMaskCharacter,
  decodeCssEscapes,
  isCssIdentifierCharacter,
  isStaticallyMagicNumber,
  isStaticallyNegative,
  protectCssSyntaxEscapes,
  unquotedUrlTokenEnd,
} from './z-index-value-analysis.mjs';

const ruleName = 'cinder/z-index-scale';
const localReasonPrefix = 'cinder-z-index-local:';
const layerTokenPattern = /^var\([\t\n\f\r ]*(--cinder-z-[\w\u0080-\uFFFF-]+)[\t\n\f\r ]*\)$/i;
const layerTokenReferencePattern = /var\([\t\n\f\r ]*(--cinder-z-[\w\u0080-\uFFFF-]+)/iy;
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
const maximumDiagnosticExpressionLength = 240;

const messages = stylelint.utils.ruleMessages(ruleName, {
  fallback:
    'A `--cinder-z-*` token must not have a fallback; define the token once in tokens-base.css.',
  bannedFallback:
    'A `var()`, `env()`, or `attr()` fallback must not contain a banned z-index escape hatch.',
  fallbackTooComplex:
    'A `var()`, `env()`, or `attr()` fallback was too complex to verify safely; simplify the expression.',
  invalid:
    '`z-index` must be `auto`, `0`, `1`, or a `--cinder-z-*` token without a fallback. ' +
    'Higher component-local values require an adjacent `cinder-z-index-local:` reason.',
});

const meta = {
  url: 'https://github.com/stevekinney/cinder/blob/main/docs/tokens.md#z-index-layers',
};

function isEscaped(value, index) {
  let backslashCount = 0;
  for (index -= 1; index >= 0 && value[index] === '\\'; index -= 1) backslashCount += 1;
  return backslashCount % 2 === 1;
}

function quotedStringEnd(value, start) {
  const quote = value[start];
  for (let index = start + 1; index < value.length; index += 1) {
    if (value[index] === '\\') {
      if (value[index + 1] === '\r' && value[index + 2] === '\n') index += 2;
      else if (value[index + 1] !== undefined) index += 1;
    } else if (value[index] === quote) return index;
    else if (value[index] === '\n' || value[index] === '\r' || value[index] === '\f') return index;
  }
  return value.length - 1;
}

// Postcss keeps `/* ... */` comments embedded inside a declaration value
// instead of tokenizing them out, so `var(--cinder-z-popover/**/, 1100)` is a
// valid way to slip a forbidden fallback past a regex that only expects
// whitespace between the token and the comma. Mask real comments with a
// same-length non-whitespace sentinel while preserving quoted and URL-token
// comment-like text and diagnostic offsets. Callers that need
// comments to delimit layer-token syntax map the sentinel to spaces locally;
// static math must not mistake comments for the whitespace required around
// additive operators.
function maskComments(value) {
  const segments = [];
  let copyFrom = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"' || value[index] === "'") {
      const stringEnd = quotedStringEnd(value, index);
      index = stringEnd;
      continue;
    }
    const urlTokenEnd = unquotedUrlTokenEnd(value, index);
    if (urlTokenEnd !== undefined) {
      index = urlTokenEnd;
      continue;
    }
    if (value[index] !== '/' || value[index + 1] !== '*' || isEscaped(value, index)) {
      continue;
    }
    segments.push(value.slice(copyFrom, index));
    const commentEnd = value.indexOf('*/', index + 2);
    if (commentEnd === -1) {
      segments.push(cssCommentMaskCharacter.repeat(value.length - index));
      copyFrom = value.length;
      break;
    }
    segments.push(cssCommentMaskCharacter.repeat(commentEnd + 2 - index));
    index = commentEnd + 1;
    copyFrom = commentEnd + 2;
  }
  if (segments.length === 0) return value;
  segments.push(value.slice(copyFrom));
  return segments.join('');
}

function findLayerTokenReferences(value) {
  const references = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"' || value[index] === "'") {
      index = quotedStringEnd(value, index);
      continue;
    }
    const urlTokenEnd = unquotedUrlTokenEnd(value, index);
    if (urlTokenEnd !== undefined) {
      index = urlTokenEnd;
      continue;
    }
    layerTokenReferencePattern.lastIndex = index;
    const match = layerTokenReferencePattern.exec(value);
    const previousCharacter = value[index - 1];
    if (
      !match ||
      isCssIdentifierCharacter(previousCharacter) ||
      previousCharacter === '#' ||
      previousCharacter === '@'
    )
      continue;
    let terminatorIndex = layerTokenReferencePattern.lastIndex;
    while (/[\t\n\f\r ]/.test(value[terminatorIndex] ?? '')) terminatorIndex += 1;
    const terminator = value[terminatorIndex];
    references.push({
      token: match[1],
      hasFallback: terminator === ',',
      isMalformed: terminator !== ',' && terminator !== ')',
    });
    index = layerTokenReferencePattern.lastIndex - 1;
  }
  return references;
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
      const declarationValue = (declaration.raws.value?.raw ?? declaration.value).trim();
      const decodedDeclarationValue = decodeCssEscapes(protectCssSyntaxEscapes(declarationValue));
      const value = maskComments(decodedDeclarationValue).trim();
      const layerTokenValue = value.replaceAll(cssCommentMaskCharacter, ' ').trim();
      const tokenMatch = layerTokenPattern.exec(layerTokenValue);
      const layerTokenReferences = findLayerTokenReferences(layerTokenValue);
      if (allowedLocalValues.has(layerTokenValue.toLowerCase())) return;
      if (tokenMatch) {
        if (declaredLayerTokens.has(tokenMatch[1])) return;
        stylelint.utils.report({ ruleName, result, node: declaration, message: messages.invalid });
        return;
      }

      if (layerTokenReferences.some(({ hasFallback }) => hasFallback)) {
        stylelint.utils.report({
          ruleName,
          result,
          node: declaration,
          message: messages.fallback,
        });
        return;
      }

      const offendingFallback = bannedFallback(declarationValue);
      if (offendingFallback) {
        const declarationText = declaration.toString();
        const declarationValueIndex = declarationText.indexOf(declarationValue);
        const fallbackValueIndex =
          offendingFallback.index === undefined ? -1 : offendingFallback.index;
        const fallbackLength = offendingFallback.length ?? offendingFallback.value.length;
        const fallbackIndex =
          fallbackValueIndex === -1 || declarationValueIndex === -1
            ? -1
            : declarationValueIndex + fallbackValueIndex;
        const originalFallback =
          fallbackValueIndex === -1
            ? offendingFallback.value
            : declarationValue.slice(fallbackValueIndex, fallbackValueIndex + fallbackLength);
        const diagnosticExpression =
          originalFallback.length <= maximumDiagnosticExpressionLength
            ? originalFallback
            : `${originalFallback.slice(0, maximumDiagnosticExpressionLength - 1)}…`;
        const diagnosticMessage =
          offendingFallback.reason === 'too-complex'
            ? messages.fallbackTooComplex
            : messages.bannedFallback;
        stylelint.utils.report({
          ruleName,
          result,
          node: declaration,
          ...(fallbackIndex >= 0
            ? {
                index: fallbackIndex,
                endIndex: fallbackIndex + fallbackLength,
              }
            : {}),
          message: `${diagnosticMessage} Offending expression: \`${diagnosticExpression.replaceAll('`', '\\`')}\`.`,
        });
        return;
      }

      // The adjacent reason is the explicit, refactor-safe allow-list for
      // component-local relationships above the universal 0/1 threshold.
      // Never allow the historical magic escape hatch back, even with a note.
      if (
        layerTokenReferences.some(
          ({ token, isMalformed }) => isMalformed || !declaredLayerTokens.has(token),
        )
      ) {
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
