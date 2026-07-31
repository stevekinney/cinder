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

const ruleName = 'cinder/z-index-scale';
const localReasonPrefix = 'cinder-z-index-local:';
const layerTokenPattern = /^var\(\s*(--cinder-z-[a-z0-9-]+)\s*\)$/i;
const layerTokenReferencePattern = /var\(\s*--cinder-z-[a-z0-9-]+\s*,/i;
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
  bannedFallback: 'A custom-property fallback must not contain a banned z-index escape hatch.',
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

// A tiny recursive-descent evaluator for +, -, *, /, unary minus, and
// parens over numeric literals — just enough to statically evaluate a
// `calc()` expression that contains no `var()` references (e.g. `0 - 1`,
// `-1 * 1`). Returns `null` if the expression isn't purely this grammar
// (in particular, anything referencing a custom property, which can't be
// evaluated without knowing its runtime value).
function evaluateConstantArithmetic(expression) {
  let index = 0;

  function peek() {
    return expression[index];
  }

  function skipSpace() {
    while (index < expression.length && /\s/.test(expression[index])) index += 1;
  }

  function parseNumber() {
    skipSpace();
    const start = index;
    if (peek() === '-') index += 1;
    let sawDigit = false;
    while (/[\d.]/.test(peek() ?? '')) {
      sawDigit = true;
      index += 1;
    }
    if (/e/i.test(peek() ?? '')) {
      index += 1;
      if (peek() === '+' || peek() === '-') index += 1;
      const exponentStart = index;
      while (/\d/.test(peek() ?? '')) index += 1;
      if (index === exponentStart) throw new Error('expected exponent');
    }
    if (!sawDigit) throw new Error('expected a number');
    return Number(expression.slice(start, index));
  }

  function parseAtom() {
    skipSpace();
    if (peek() === '(') {
      index += 1;
      const value = parseExpression();
      skipSpace();
      if (peek() !== ')') throw new Error('expected )');
      index += 1;
      return value;
    }
    if (peek() === '-') {
      index += 1;
      return -parseAtom();
    }
    return parseNumber();
  }

  function parseTerm() {
    let value = parseAtom();
    for (;;) {
      skipSpace();
      const operator = peek();
      if (operator !== '*' && operator !== '/') return value;
      index += 1;
      const rhs = parseAtom();
      value = operator === '*' ? value * rhs : value / rhs;
    }
  }

  function parseExpression() {
    let value = parseTerm();
    for (;;) {
      skipSpace();
      const operator = peek();
      if (operator !== '+' && operator !== '-') return value;
      index += 1;
      const rhs = parseTerm();
      value = operator === '+' ? value + rhs : value - rhs;
    }
  }

  try {
    const result = parseExpression();
    skipSpace();
    return index === expression.length && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

// `Number('calc(-1)')` is `NaN`, not `-1` — a plain `Number(value) < 0` check
// never sees a negative value wrapped in `calc()`, and arithmetic like
// `calc(0 - 1)` is statically negative without being a bare numeric literal
// either. A declaration with a `cinder-z-index-local:` reason and either
// shape would otherwise slip past the rule's prohibition on negative local
// stacking levels. Unwrap a single `calc(...)` layer, then fall back to a
// constant-arithmetic evaluator for expressions `Number()` can't parse.
// Returns `null` when the value can't be statically resolved to a number at
// all (e.g. it references a custom property).
function resolveStaticNumber(value) {
  const expression = flattenCalcFunctions(value);
  const direct = Number(expression);
  if (Number.isFinite(direct)) return direct;
  return evaluateConstantArithmetic(expression);
}

function decodeCssEscapes(value) {
  return value
    .replaceAll(/\\([0-9a-f]{1,6})(?:\s)?/gi, (_, codePoint) => {
      const codePointValue = Number.parseInt(codePoint, 16);
      return codePointValue > 0x10ffff ? '\ufffd' : String.fromCodePoint(codePointValue);
    })
    .replaceAll(/\\(.)/g, '$1');
}

function flattenCalcFunctions(value) {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    if (!/^calc\s*\(/i.test(value.slice(index))) {
      output += value[index];
      continue;
    }
    const openIndex = value.indexOf('(', index);
    let depth = 1;
    let closeIndex = openIndex + 1;
    while (closeIndex < value.length && depth > 0) {
      if (value[closeIndex] === '(') depth += 1;
      if (value[closeIndex] === ')') depth -= 1;
      closeIndex += 1;
    }
    if (depth !== 0) {
      output += value.slice(index);
      break;
    }
    output += `(${flattenCalcFunctions(value.slice(openIndex + 1, closeIndex - 1))})`;
    index = closeIndex - 1;
  }
  return output;
}

function isStaticallyNegative(value) {
  const resolved = resolveStaticNumber(value);
  return resolved !== null && resolved < 0;
}

// The historical `9999` escape hatch must stay banned even when wrapped in
// arithmetic that evaluates to the same number (`calc(9999)`,
// `calc(10000 - 1)`) — a plain string comparison against `'9999'` only
// catches the literal, not a calculated equivalent.
function isStaticallyMagicNumber(value) {
  const resolved = resolveStaticNumber(value);
  return resolved !== null && resolved === 9999;
}

// Extract fallback arguments from every `var()` call, including nested calls.
// The primary custom property is intentionally opaque: an unresolved property
// is valid when it has no fallback, and a design-token fallback remains valid.
// Only the fallback expression itself is evaluated for banned literals.
function customPropertyFallbacks(value) {
  const fallbacks = [];

  function visit(expression) {
    for (let index = 0; index < expression.length; index += 1) {
      if (!/^var\s*\(/i.test(expression.slice(index))) continue;
      const previousCharacter = expression[index - 1];
      if (previousCharacter && /[\w-]/.test(previousCharacter)) continue;

      const openIndex = expression.indexOf('(', index);
      let depth = 1;
      let closeIndex = openIndex + 1;
      while (closeIndex < expression.length && depth > 0) {
        if (expression[closeIndex] === '(') depth += 1;
        if (expression[closeIndex] === ')') depth -= 1;
        closeIndex += 1;
      }
      if (depth !== 0) break;

      const content = expression.slice(openIndex + 1, closeIndex - 1);
      let argumentDepth = 0;
      let commaIndex = -1;
      for (let contentIndex = 0; contentIndex < content.length; contentIndex += 1) {
        if (content[contentIndex] === '(') argumentDepth += 1;
        if (content[contentIndex] === ')') argumentDepth -= 1;
        if (content[contentIndex] === ',' && argumentDepth === 0) {
          commaIndex = contentIndex;
          break;
        }
      }
      if (commaIndex !== -1) {
        const fallback = content.slice(commaIndex + 1).trim();
        fallbacks.push(fallback);
        visit(fallback);
      }
      index = closeIndex - 1;
    }
  }

  visit(value);
  return fallbacks;
}

function bannedFallback(value) {
  const protectedValue = value.replaceAll(/\\,/g, '\uE000');
  return customPropertyFallbacks(decodeCssEscapes(protectedValue)).find(
    (fallback) => isStaticallyNegative(fallback) || isStaticallyMagicNumber(fallback),
  );
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
      const value = decodeCssEscapes(rawValue.replaceAll(/\\,/g, '\uE000'));
      const tokenMatch = layerTokenPattern.exec(value);
      if (allowedLocalValues.has(value)) return;
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

      const offendingFallback = bannedFallback(value);
      if (offendingFallback) {
        const declarationText = declaration.toString();
        const fallbackIndex = declarationText.indexOf(offendingFallback);
        stylelint.utils.report({
          ruleName,
          result,
          node: declaration,
          ...(fallbackIndex >= 0
            ? { index: fallbackIndex, endIndex: fallbackIndex + offendingFallback.length }
            : {}),
          message: `${messages.bannedFallback} Offending fallback: \`${offendingFallback}\`.`,
        });
        return;
      }

      // The adjacent reason is the explicit, refactor-safe allow-list for
      // component-local relationships above the universal 0/1 threshold.
      // Never allow the historical magic escape hatch back, even with a note.
      const referencedTokens = [...value.matchAll(/var\(\s*(--cinder-z-[\w-]+)/g)].map(
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
