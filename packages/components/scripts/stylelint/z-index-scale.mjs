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
  bannedFallback: 'A `var()` or `env()` fallback must not contain a banned z-index escape hatch.',
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

const absoluteLengthUnitFactors = new Map([
  ['px', 1],
  ['in', 96],
  ['cm', 96 / 2.54],
  ['mm', 96 / 25.4],
  ['q', 96 / 101.6],
  ['pt', 96 / 72],
  ['pc', 16],
]);

function scalar(value) {
  return { value, units: new Map() };
}

function withValue(source, value) {
  return { value, units: new Map(source.units) };
}

function sameUnits(left, right) {
  if (left.units.size !== right.units.size) return false;
  return [...left.units].every(([unit, exponent]) => right.units.get(unit) === exponent);
}

function combineUnits(left, right, direction) {
  const units = new Map(left.units);
  for (const [unit, exponent] of right.units) {
    const combined = (units.get(unit) ?? 0) + direction * exponent;
    if (combined === 0) units.delete(unit);
    else units.set(unit, combined);
  }
  return units;
}

// Evaluate static CSS math while retaining enough type information for
// compatible units to cancel during division. Unknown units remain distinct,
// but identical units can still cancel without needing layout context.
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
    if (peek() === '-' || peek() === '+') index += 1;
    let sawDigit = false;
    while (/[\d.]/.test(peek() ?? '')) {
      sawDigit = true;
      index += 1;
    }
    if (/e/i.test(peek() ?? '') && /[+\-\d]/.test(expression[index + 1] ?? '')) {
      index += 1;
      if (peek() === '+' || peek() === '-') index += 1;
      const exponentStart = index;
      while (/\d/.test(peek() ?? '')) index += 1;
      if (index === exponentStart) throw new Error('expected exponent');
    }
    if (!sawDigit) throw new Error('expected a number');
    let value = Number(expression.slice(start, index));
    const unitStart = index;
    while (/[a-z%]/i.test(peek() ?? '')) index += 1;
    const unit = expression.slice(unitStart, index).toLowerCase();
    if (!unit) return scalar(value);
    const factor = absoluteLengthUnitFactors.get(unit);
    const unitKey = factor === undefined ? `unit:${unit}` : 'dimension:length';
    if (factor !== undefined) value *= factor;
    return { value, units: new Map([[unitKey, 1]]) };
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
      const value = parseAtom();
      return withValue(value, -value.value);
    }
    const functionStart = index;
    while (/[a-z-]/i.test(peek() ?? '')) index += 1;
    if (index !== functionStart) {
      const functionName = expression.slice(functionStart, index).toLowerCase();
      skipSpace();
      if (peek() !== '(') throw new Error('expected function arguments');
      index += 1;
      const arguments_ = [];
      for (;;) {
        arguments_.push(parseExpression());
        skipSpace();
        if (peek() === ')') {
          index += 1;
          break;
        }
        if (peek() !== ',') throw new Error('expected comma');
        index += 1;
      }
      if (!arguments_.every((argument) => sameUnits(argument, arguments_[0])))
        throw new Error('incompatible units');
      if (functionName === 'min' && arguments_.length > 0)
        return withValue(arguments_[0], Math.min(...arguments_.map(({ value }) => value)));
      if (functionName === 'max' && arguments_.length > 0)
        return withValue(arguments_[0], Math.max(...arguments_.map(({ value }) => value)));
      if (functionName === 'clamp' && arguments_.length === 3)
        return withValue(
          arguments_[0],
          Math.max(arguments_[0].value, Math.min(arguments_[1].value, arguments_[2].value)),
        );
      if (functionName === 'abs' && arguments_.length === 1)
        return withValue(arguments_[0], Math.abs(arguments_[0].value));
      if (functionName === 'sign' && arguments_.length === 1)
        return scalar(Math.sign(arguments_[0].value));
      throw new Error('unsupported function');
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
      value = {
        value: operator === '*' ? value.value * rhs.value : value.value / rhs.value,
        units: combineUnits(value, rhs, operator === '*' ? 1 : -1),
      };
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
      if (!sameUnits(value, rhs)) throw new Error('incompatible units');
      value = withValue(
        value,
        operator === '+' ? value.value + rhs.value : value.value - rhs.value,
      );
    }
  }

  try {
    const result = parseExpression();
    skipSpace();
    return index === expression.length && result.units.size === 0 && Number.isFinite(result.value)
      ? result.value
      : null;
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
  if (Number.isFinite(direct)) return roundCssInteger(direct);
  const evaluated = evaluateConstantArithmetic(expression);
  return evaluated === null ? null : roundCssInteger(evaluated);
}

function decodeCssEscapes(value) {
  return value
    .replaceAll(/\\([0-9a-f]{1,6})(?:\s)?/gi, (_, codePoint) => {
      const codePointValue = Number.parseInt(codePoint, 16);
      return codePointValue > 0x10ffff ? '\ufffd' : String.fromCodePoint(codePointValue);
    })
    .replaceAll(/\\(.)/g, '$1');
}

function protectCssSyntaxEscapes(value) {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      output += value[index];
      continue;
    }

    const nextCharacter = value[index + 1];
    if (nextCharacter === undefined) {
      output += value[index];
      continue;
    }

    if (/[0-9a-f]/i.test(nextCharacter)) {
      let hexEnd = index + 1;
      while (hexEnd < value.length && hexEnd <= index + 6 && /[0-9a-f]/i.test(value[hexEnd]))
        hexEnd += 1;
      const codePoint = Number.parseInt(value.slice(index + 1, hexEnd), 16);
      let escapeEnd = hexEnd;
      if (/\s/.test(value[escapeEnd] ?? '')) escapeEnd += 1;
      if (codePoint === 0x2c) output += '\uE000';
      else if (codePoint === 0x28) output += '\uE001';
      else if (codePoint === 0x29) output += '\uE002';
      else output += value.slice(index, escapeEnd);
      index = escapeEnd - 1;
      continue;
    }

    if (nextCharacter === ',') output += '\uE000';
    else if (nextCharacter === '(') output += '\uE001';
    else if (nextCharacter === ')') output += '\uE002';
    else output += value.slice(index, index + 2);
    index += 1;
  }
  return output;
}

function isCssIdentifierCharacter(character) {
  return character !== undefined && /[\w\u0080-\uFFFF-]/.test(character);
}

function flattenCalcFunctions(value) {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const calcMatch = /^(?:-webkit-)?calc\s*\(/i.exec(value.slice(index));
    const previousCharacter = value[index - 1];
    if (!calcMatch || isCssIdentifierCharacter(previousCharacter)) {
      output += value[index];
      continue;
    }
    const openIndex = index + calcMatch[0].lastIndexOf('(');
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

// CSS rounds integer-context values to the nearest integer, with ties toward
// positive infinity (for example, -1.5 becomes -1 and 9998.5 becomes 9999).
function roundCssInteger(value) {
  return Math.floor(value + 0.5);
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

// Extract fallback arguments from every `var()` and `env()` call, including
// nested calls. The unresolved primary value is intentionally opaque; only
// fallback expressions are evaluated for banned literals.
function cssFallbacks(value) {
  const fallbacks = [];

  function visit(expression) {
    for (let index = 0; index < expression.length; index += 1) {
      if (!/^(?:var|env)\s*\(/i.test(expression.slice(index))) continue;
      const previousCharacter = expression[index - 1];
      if (isCssIdentifierCharacter(previousCharacter)) continue;

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
  const protectedValue = protectCssSyntaxEscapes(value);
  return cssFallbacks(decodeCssEscapes(protectedValue)).find(
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
      const value = decodeCssEscapes(protectCssSyntaxEscapes(rawValue));
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

      const offendingFallback = bannedFallback(rawValue);
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
