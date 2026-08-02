const canonicalUnitConversions = new Map([
  ['px', { dimension: 'length', factor: 1 }],
  ['in', { dimension: 'length', factor: 96 }],
  ['cm', { dimension: 'length', factor: 96 / 2.54 }],
  ['mm', { dimension: 'length', factor: 96 / 25.4 }],
  ['q', { dimension: 'length', factor: 96 / 101.6 }],
  ['pt', { dimension: 'length', factor: 96 / 72 }],
  ['pc', { dimension: 'length', factor: 16 }],
  ['deg', { dimension: 'angle', factor: 1 }],
  ['grad', { dimension: 'angle', factor: 0.9 }],
  ['rad', { dimension: 'angle', factor: 180 / Math.PI }],
  ['turn', { dimension: 'angle', factor: 360 }],
  ['s', { dimension: 'time', factor: 1 }],
  ['ms', { dimension: 'time', factor: 0.001 }],
  ['hz', { dimension: 'frequency', factor: 1 }],
  ['khz', { dimension: 'frequency', factor: 1000 }],
  ['dppx', { dimension: 'resolution', factor: 1 }],
  ['x', { dimension: 'resolution', factor: 1 }],
  ['dpi', { dimension: 'resolution', factor: 1 / 96 }],
  ['dpcm', { dimension: 'resolution', factor: 2.54 / 96 }],
  ['fr', { dimension: 'flex', factor: 1 }],
]);
const relativeLengthUnitNames = new Set([
  'em',
  'rem',
  'ex',
  'rex',
  'cap',
  'rcap',
  'ch',
  'rch',
  'ic',
  'ric',
  'lh',
  'rlh',
  'vw',
  'svw',
  'lvw',
  'dvw',
  'vh',
  'svh',
  'lvh',
  'dvh',
  'vi',
  'svi',
  'lvi',
  'dvi',
  'vb',
  'svb',
  'lvb',
  'dvb',
  'vmin',
  'svmin',
  'lvmin',
  'dvmin',
  'vmax',
  'svmax',
  'lvmax',
  'dvmax',
  'cqw',
  'cqh',
  'cqi',
  'cqb',
  'cqmin',
  'cqmax',
]);
const calcFunctionPattern = /(?:-webkit-)?calc\(/iy;
const staticAnalysisTooComplex = Symbol('static-analysis-too-complex');
const unboundedClampEndpoint = Symbol('unbounded-clamp-endpoint');

export const cssCommentMaskCharacter = '\uE001';

export function isCssWhitespace(character) {
  return character !== undefined && /[\t\n\f\r ]/.test(character);
}

export function isCssWhitespaceOrComment(character) {
  return isCssWhitespace(character) || character === cssCommentMaskCharacter;
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

// CSS numeric tokens spell only positive zero; generated arithmetic can still
// produce negative zero that nested functions must preserve.
function scalar(value, isLiteralZero = false) {
  return { value, units: new Map(), isLiteralZero };
}

function withValue(source, value) {
  return { value, units: new Map(source.units), isLiteralZero: false };
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

function angleInRadians(value) {
  if (value.units.size === 0) return value.value;
  if (value.units.size === 1 && value.units.get('dimension:angle') === 1)
    return (value.value * Math.PI) / 180;
  throw new Error('expected a number or angle');
}

function angleInDegrees(value) {
  return { value: (value * 180) / Math.PI, units: new Map([['dimension:angle', 1]]) };
}

function exactCardinalTrigonometricValue(functionName, argument) {
  let quarterTurns;
  if (argument.units.size === 0) quarterTurns = argument.value / (Math.PI / 2);
  else if (argument.units.size === 1 && argument.units.get('dimension:angle') === 1)
    quarterTurns = argument.value / 90;
  else throw new Error('expected a number or angle');
  if (!Number.isInteger(quarterTurns)) return undefined;

  if ((functionName === 'sin' || functionName === 'tan') && Object.is(argument.value, -0))
    return -0;

  const normalizedQuarterTurns = ((quarterTurns % 4) + 4) % 4;
  if (functionName === 'sin') return [0, 1, 0, -1][normalizedQuarterTurns];
  if (functionName === 'cos') return [1, 0, -1, 0][normalizedQuarterTurns];
  if (normalizedQuarterTurns % 2 === 0) return 0;
  return normalizedQuarterTurns === 1 ? Infinity : -Infinity;
}

function hasNegativeSign(value) {
  return value < 0 || Object.is(value, -0);
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
    while (index < expression.length && isCssWhitespaceOrComment(expression[index])) index += 1;
  }

  function adjacentTriviaContainsWhitespace(operatorIndex, direction) {
    for (
      let cursor = operatorIndex + direction;
      isCssWhitespaceOrComment(expression[cursor]);
      cursor += direction
    ) {
      if (isCssWhitespace(expression[cursor])) return true;
    }
    return false;
  }

  function parseNumber() {
    skipSpace();
    const start = index;
    if (peek() === '-' || peek() === '+') index += 1;
    let sawDigit = false;
    while (/\d/.test(peek() ?? '')) {
      sawDigit = true;
      index += 1;
    }
    if (peek() === '.' && /\d/.test(expression[index + 1] ?? '')) {
      index += 1;
      while (/\d/.test(peek() ?? '')) {
        sawDigit = true;
        index += 1;
      }
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
    if (!unit) return scalar(value, value === 0);
    const conversion = canonicalUnitConversions.get(unit);
    if (conversion === undefined && unit !== '%' && !relativeLengthUnitNames.has(unit))
      throw new Error('unknown unit');
    const unitKey = conversion === undefined ? `unit:${unit}` : `dimension:${conversion.dimension}`;
    if (conversion !== undefined) value *= conversion.factor;
    return { value, units: new Map([[unitKey, 1]]), isLiteralZero: value === 0 };
  }

  function parsePrimary() {
    skipSpace();
    if (peek() === '(') {
      index += 1;
      const value = parseExpression();
      skipSpace();
      if (peek() !== ')') throw new Error('expected )');
      index += 1;
      return value;
    }
    const functionStart = index;
    if (/[a-z-]/i.test(peek() ?? '')) {
      index += 1;
      while (/[a-z0-9-]/i.test(peek() ?? '')) index += 1;
    }
    if (index !== functionStart) {
      const functionName = expression.slice(functionStart, index).toLowerCase();
      if (peek() !== '(') {
        if (functionName === 'e') return scalar(Math.E);
        if (functionName === 'pi') return scalar(Math.PI);
        if (functionName === 'infinity') return scalar(Infinity);
        if (functionName === 'nan') return scalar(Number.NaN);
        throw new Error('expected function arguments');
      }
      index += 1;
      let roundStrategy = 'nearest';
      if (functionName === 'round') {
        skipSpace();
        const strategyMatch = /^(?:nearest|up|down|to-zero)/i.exec(expression.slice(index));
        if (strategyMatch) {
          roundStrategy = strategyMatch[0].toLowerCase();
          index += strategyMatch[0].length;
          skipSpace();
          if (peek() !== ',') throw new Error('expected comma after round strategy');
          index += 1;
        }
      }
      const arguments_ = [];
      for (;;) {
        skipSpace();
        const clampEndpointCanBeUnbounded =
          functionName === 'clamp' && (arguments_.length === 0 || arguments_.length === 2);
        const noneMatch = clampEndpointCanBeUnbounded
          ? /^none(?=[\t\n\f\r \uE001]*[,)])/i.exec(expression.slice(index))
          : null;
        if (noneMatch) {
          arguments_.push(unboundedClampEndpoint);
          index += noneMatch[0].length;
        } else arguments_.push(parseExpression());
        skipSpace();
        if (peek() === ')') {
          index += 1;
          break;
        }
        if (peek() !== ',') throw new Error('expected comma');
        index += 1;
      }
      const boundedArguments = arguments_.filter((argument) => argument !== unboundedClampEndpoint);
      if (!boundedArguments.every((argument) => sameUnits(argument, boundedArguments[0])))
        throw new Error('incompatible units');
      if ((functionName === 'min' || functionName === 'max') && arguments_.length > 0) {
        let reducedValue = arguments_[0].value;
        for (let argumentIndex = 1; argumentIndex < arguments_.length; argumentIndex += 1)
          reducedValue = Math[functionName](reducedValue, arguments_[argumentIndex].value);
        return withValue(arguments_[0], reducedValue);
      }
      if (functionName === 'clamp' && arguments_.length === 3) {
        const [minimum, value, maximum] = arguments_;
        if (value === unboundedClampEndpoint) throw new Error('expected a central value');
        const minimumValue = minimum === unboundedClampEndpoint ? -Infinity : minimum.value;
        const maximumValue = maximum === unboundedClampEndpoint ? Infinity : maximum.value;
        return withValue(value, Math.max(minimumValue, Math.min(value.value, maximumValue)));
      }
      if (functionName === 'abs' && arguments_.length === 1)
        return withValue(arguments_[0], Math.abs(arguments_[0].value));
      if (functionName === 'sign' && arguments_.length === 1)
        return scalar(Math.sign(arguments_[0].value));
      if ((functionName === 'mod' || functionName === 'rem') && arguments_.length === 2) {
        const [dividend, divisor] = arguments_;
        if (divisor.value === 0) throw new Error('zero divisor');
        if (!Number.isFinite(dividend.value)) return withValue(dividend, Number.NaN);
        if (!Number.isFinite(divisor.value)) {
          if (Number.isNaN(divisor.value)) return withValue(dividend, Number.NaN);
          const signsDiffer = hasNegativeSign(dividend.value) !== hasNegativeSign(divisor.value);
          return withValue(
            dividend,
            functionName === 'mod' && signsDiffer ? Number.NaN : dividend.value,
          );
        }
        const quotient = dividend.value / divisor.value;
        const result =
          dividend.value -
          divisor.value * (functionName === 'mod' ? Math.floor(quotient) : Math.trunc(quotient));
        const zeroSignSource = functionName === 'mod' ? divisor.value : dividend.value;
        return withValue(
          dividend,
          result === 0 ? (hasNegativeSign(zeroSignSource) ? -0 : 0) : result,
        );
      }
      if (functionName === 'round' && arguments_.length >= 1 && arguments_.length <= 2) {
        const [value, interval = withValue(arguments_[0], 1)] = arguments_;
        if (interval.value === 0) throw new Error('zero interval');
        if (!Number.isFinite(interval.value)) {
          if (Number.isNaN(interval.value) || !Number.isFinite(value.value))
            return withValue(value, Number.NaN);
          const isNegative = hasNegativeSign(value.value);
          if (roundStrategy === 'up')
            return withValue(value, value.value > 0 ? Infinity : isNegative ? -0 : 0);
          if (roundStrategy === 'down')
            return withValue(value, value.value < 0 ? -Infinity : isNegative ? -0 : 0);
          return withValue(value, isNegative ? -0 : 0);
        }
        if (!Number.isFinite(value.value)) return withValue(value, value.value);
        const intervalMagnitude = Math.abs(interval.value);
        const ratio = value.value / intervalMagnitude;
        // CSS returns an exact multiple unchanged, including its signed zero.
        if (Number.isInteger(ratio)) return withValue(value, value.value);
        const rounded =
          roundStrategy === 'up'
            ? Math.ceil(ratio)
            : roundStrategy === 'down'
              ? Math.floor(ratio)
              : roundStrategy === 'to-zero'
                ? Math.trunc(ratio)
                : Math.floor(ratio + 0.5);
        return withValue(value, rounded * intervalMagnitude);
      }
      if (functionName === 'pow' && arguments_.length === 2) {
        if (arguments_.some(({ units }) => units.size !== 0)) throw new Error('expected numbers');
        return scalar(Math.pow(arguments_[0].value, arguments_[1].value));
      }
      if (functionName === 'sqrt' && arguments_.length === 1) {
        if (arguments_[0].units.size !== 0) throw new Error('expected a number');
        return scalar(Math.sqrt(arguments_[0].value));
      }
      if (functionName === 'hypot' && arguments_.length > 0) {
        let hypotenuse = 0;
        for (const argument of arguments_) hypotenuse = Math.hypot(hypotenuse, argument.value);
        return withValue(arguments_[0], hypotenuse);
      }
      if (functionName === 'log' && arguments_.length >= 1 && arguments_.length <= 2) {
        if (arguments_.some(({ units }) => units.size !== 0)) throw new Error('expected numbers');
        return scalar(
          arguments_.length === 1
            ? Math.log(arguments_[0].value)
            : Math.log(arguments_[0].value) / Math.log(arguments_[1].value),
        );
      }
      if (functionName === 'exp' && arguments_.length === 1) {
        if (arguments_[0].units.size !== 0) throw new Error('expected a number');
        return scalar(Math.exp(arguments_[0].value));
      }
      if (
        (functionName === 'sin' || functionName === 'cos' || functionName === 'tan') &&
        arguments_.length === 1
      ) {
        const exactValue = exactCardinalTrigonometricValue(functionName, arguments_[0]);
        return scalar(
          exactValue === undefined ? Math[functionName](angleInRadians(arguments_[0])) : exactValue,
        );
      }
      if (
        (functionName === 'asin' || functionName === 'acos' || functionName === 'atan') &&
        arguments_.length === 1
      ) {
        if (arguments_[0].units.size !== 0) throw new Error('expected a number');
        return angleInDegrees(Math[functionName](arguments_[0].value));
      }
      if (functionName === 'atan2' && arguments_.length === 2)
        return angleInDegrees(Math.atan2(arguments_[0].value, arguments_[1].value));
      if (functionName === 'progress' && arguments_.length === 3) {
        const [value, start, end] = arguments_;
        if (start.value === end.value) return scalar(value.value <= start.value ? 0 : 1);
        const ratio = (value.value - start.value) / (end.value - start.value);
        return scalar(Math.min(1, Math.max(0, ratio)));
      }
      throw new Error('unsupported function');
    }
    return parseNumber();
  }

  function parseAtom() {
    skipSpace();
    let isNegative = false;
    while (peek() === '-' || peek() === '+') {
      if (peek() === '-') isNegative = !isNegative;
      index += 1;
      skipSpace();
    }
    const value = parsePrimary();
    if (!isNegative) return value;
    return withValue(value, value.isLiteralZero ? 0 : -value.value);
  }

  function parseTerm() {
    let value = parseAtom();
    for (;;) {
      skipSpace();
      const operator = peek();
      if (operator !== '*' && operator !== '/') return value;
      index += 1;
      const right = parseAtom();
      value = {
        value: operator === '*' ? value.value * right.value : value.value / right.value,
        units: combineUnits(value, right, operator === '*' ? 1 : -1),
      };
    }
  }

  function parseExpression() {
    let value = parseTerm();
    for (;;) {
      skipSpace();
      const operator = peek();
      if (operator !== '+' && operator !== '-') return value;
      if (
        !adjacentTriviaContainsWhitespace(index, -1) ||
        !adjacentTriviaContainsWhitespace(index, 1)
      )
        throw new Error('expected whitespace around additive operator');
      index += 1;
      const right = parseTerm();
      if (!sameUnits(value, right)) throw new Error('incompatible units');
      value = withValue(
        value,
        operator === '+' ? value.value + right.value : value.value - right.value,
      );
    }
  }

  try {
    const result = parseExpression();
    skipSpace();
    return index === expression.length && result.units.size === 0 && !Number.isNaN(result.value)
      ? result.value
      : null;
  } catch {
    return null;
  }
}

function flattenCalcFunctions(value) {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    calcFunctionPattern.lastIndex = index;
    const calcMatch = calcFunctionPattern.exec(value);
    const previousCharacter = value[index - 1];
    if (!calcMatch || isCssIdentifierCharacter(previousCharacter)) {
      output += value[index];
      continue;
    }
    output += '(';
    index += calcMatch[0].length - 1;
  }
  return output;
}

function collapseSimpleParenthesisChain(expression) {
  let start = 0;
  let end = expression.length;
  while (expression[start] === '(' && expression[end - 1] === ')') {
    start += 1;
    end -= 1;
  }
  const center = expression.slice(start, end);
  return /[()]/.test(center) ? expression : center;
}

function exceedsStaticAnalysisDepth(expression) {
  let depth = 0;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (character === '"' || character === "'") {
      index = quotedStringEnd(expression, index);
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (depth > 512) return true;
  }
  return false;
}

function resolveStaticValue(value) {
  const expression = collapseSimpleParenthesisChain(flattenCalcFunctions(value));
  if (exceedsStaticAnalysisDepth(expression)) return staticAnalysisTooComplex;
  return evaluateConstantArithmetic(expression);
}

function resolveStaticNumber(value) {
  const evaluated = resolveStaticValue(value);
  return evaluated === null || evaluated === staticAnalysisTooComplex
    ? evaluated
    : Math.floor(evaluated + 0.5);
}

export function decodeCssEscapes(value) {
  return decodeCssEscapesForInspection(value).value;
}

function appendMappedCharacter(output, sourceRanges, character, sourceRange) {
  output.push(character);
  for (let index = 0; index < character.length; index += 1) sourceRanges.push(sourceRange);
}

function appendMappedSlice(output, sourceRanges, value, start, end, baseRanges) {
  output.push(value.slice(start, end));
  for (let index = start; index < end; index += 1) sourceRanges.push(baseRanges[index]);
}

function literalSourceRanges(value) {
  return Array.from({ length: value.length }, (_, index) => ({ start: index, end: index + 1 }));
}

function decodeCssEscapesForInspection(value, baseRanges = literalSourceRanges(value)) {
  const output = [];
  const sourceRanges = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      appendMappedCharacter(output, sourceRanges, value[index], baseRanges[index]);
      continue;
    }

    const nextCharacter = value[index + 1];
    if (nextCharacter === undefined || /[\n\f\r]/.test(nextCharacter)) {
      appendMappedCharacter(output, sourceRanges, value[index], baseRanges[index]);
      continue;
    }
    if (!/[0-9a-f]/i.test(nextCharacter)) {
      appendMappedCharacter(output, sourceRanges, nextCharacter, {
        start: baseRanges[index].start,
        end: baseRanges[index + 1].end,
      });
      index += 1;
      continue;
    }

    let hexEnd = index + 1;
    while (hexEnd < value.length && hexEnd <= index + 6 && /[0-9a-f]/i.test(value[hexEnd]))
      hexEnd += 1;
    const codePointValue = Number.parseInt(value.slice(index + 1, hexEnd), 16);
    const decodedCharacter =
      codePointValue === 0 || codePointValue > 0x10ffff
        ? '\ufffd'
        : String.fromCodePoint(codePointValue);
    let escapeEnd = hexEnd;
    if (value[escapeEnd] === '\r' && value[escapeEnd + 1] === '\n') escapeEnd += 2;
    else if (isCssWhitespace(value[escapeEnd])) escapeEnd += 1;
    appendMappedCharacter(output, sourceRanges, decodedCharacter, {
      start: baseRanges[index].start,
      end: baseRanges[escapeEnd - 1].end,
    });
    index = escapeEnd - 1;
  }
  return { value: output.join(''), sourceRanges };
}

export function normalizeCssEscapesForInspection(value) {
  const output = [];
  const sourceRanges = [];
  const baseRanges = literalSourceRanges(value);
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      appendMappedCharacter(output, sourceRanges, value[index], baseRanges[index]);
      continue;
    }

    const nextCharacter = value[index + 1];
    if (nextCharacter === undefined) {
      appendMappedCharacter(output, sourceRanges, value[index], baseRanges[index]);
      continue;
    }

    if (/[0-9a-f]/i.test(nextCharacter)) {
      let hexEnd = index + 1;
      while (hexEnd < value.length && hexEnd <= index + 6 && /[0-9a-f]/i.test(value[hexEnd]))
        hexEnd += 1;
      const codePoint = Number.parseInt(value.slice(index + 1, hexEnd), 16);
      let escapeEnd = hexEnd;
      if (value[escapeEnd] === '\r' && value[escapeEnd + 1] === '\n') escapeEnd += 2;
      else if (isCssWhitespace(value[escapeEnd])) escapeEnd += 1;
      const decodedCharacter =
        codePoint === 0 || codePoint > 0x10ffff ? '\ufffd' : String.fromCodePoint(codePoint);
      if (/\d/.test(decodedCharacter))
        appendMappedCharacter(output, sourceRanges, '\uE000', {
          start: baseRanges[index].start,
          end: baseRanges[escapeEnd - 1].end,
        });
      else if (isCssIdentifierCharacter(decodedCharacter)) {
        const beginsDimensionUnit = /[\d.]/.test(value[index - 1] ?? '');
        if (beginsDimensionUnit)
          appendMappedCharacter(output, sourceRanges, '\uE000', {
            start: baseRanges[index].start,
            end: baseRanges[escapeEnd - 1].end,
          });
        else appendMappedSlice(output, sourceRanges, value, index, escapeEnd, baseRanges);
      } else
        appendMappedCharacter(output, sourceRanges, '\uE000', {
          start: baseRanges[index].start,
          end: baseRanges[escapeEnd - 1].end,
        });
      index = escapeEnd - 1;
      continue;
    }

    if (/[\n\f\r]/.test(nextCharacter) || isCssIdentifierCharacter(nextCharacter))
      appendMappedSlice(output, sourceRanges, value, index, index + 2, baseRanges);
    else
      appendMappedCharacter(output, sourceRanges, '\uE000', {
        start: baseRanges[index].start,
        end: baseRanges[index + 1].end,
      });
    index += 1;
  }
  return decodeCssEscapesForInspection(output.join(''), sourceRanges);
}

export function protectCssSyntaxEscapes(value) {
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
      if (value[escapeEnd] === '\r' && value[escapeEnd + 1] === '\n') escapeEnd += 2;
      else if (isCssWhitespace(value[escapeEnd])) escapeEnd += 1;
      const decodedCharacter =
        codePoint === 0 || codePoint > 0x10ffff ? '\ufffd' : String.fromCodePoint(codePoint);
      // An escaped digit is an identifier code point, never part of a number token.
      output += /\d/.test(decodedCharacter)
        ? '\uE000'
        : isCssIdentifierCharacter(decodedCharacter)
          ? value.slice(index, escapeEnd)
          : '\uE000';
      index = escapeEnd - 1;
      continue;
    }

    if (/[\n\f\r]/.test(nextCharacter) || isCssIdentifierCharacter(nextCharacter))
      output += value.slice(index, index + 2);
    else output += '\uE000';
    index += 1;
  }
  return output;
}

export function isCssIdentifierCharacter(character) {
  return character !== undefined && /[\w\u0080-\uFFFF-]/.test(character);
}

export function classifyStaticLayer(value) {
  const resolved = resolveStaticNumber(value);
  if (resolved === staticAnalysisTooComplex) return 'too-complex';
  if (resolved === null) return 'unresolved';
  if (resolved < 0) return 'negative';
  if (resolved === 9999) return 'magic';
  return 'safe';
}

export function isStaticallyNegative(value) {
  const classification = classifyStaticLayer(value);
  return (
    (classification === 'too-complex' &&
      !/(?:^|[^\w\u0080-\uFFFF-])(?:var|env|attr)\(/i.test(value)) ||
    classification === 'negative'
  );
}

export function isStaticallyMagicNumber(value) {
  const classification = classifyStaticLayer(value);
  return (
    (classification === 'too-complex' &&
      !/(?:^|[^\w\u0080-\uFFFF-])(?:var|env|attr)\(/i.test(value)) ||
    classification === 'magic'
  );
}

export function isStaticallyZero(value) {
  return resolveStaticValue(value) === 0;
}

export function isStaticallyNegativeZero(value) {
  return Object.is(resolveStaticValue(value), -0);
}
