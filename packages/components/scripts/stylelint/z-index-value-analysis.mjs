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
]);
const calcFunctionPattern = /(?:-webkit-)?calc\(/iy;
const staticAnalysisTooComplex = Symbol('static-analysis-too-complex');

export function isCssWhitespace(character) {
  return character !== undefined && /[\t\n\f\r ]/.test(character);
}

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

function angleInRadians(value) {
  if (value.units.size === 0) return value.value;
  if (value.units.size === 1 && value.units.get('dimension:angle') === 1)
    return (value.value * Math.PI) / 180;
  throw new Error('expected a number or angle');
}

function angleInDegrees(value) {
  return { value: (value * 180) / Math.PI, units: new Map([['dimension:angle', 1]]) };
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
    while (index < expression.length && isCssWhitespace(expression[index])) index += 1;
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
    const conversion = canonicalUnitConversions.get(unit);
    const unitKey = conversion === undefined ? `unit:${unit}` : `dimension:${conversion.dimension}`;
    if (conversion !== undefined) value *= conversion.factor;
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
      if ((functionName === 'min' || functionName === 'max') && arguments_.length > 0) {
        let reducedValue = arguments_[0].value;
        for (let argumentIndex = 1; argumentIndex < arguments_.length; argumentIndex += 1)
          reducedValue = Math[functionName](reducedValue, arguments_[argumentIndex].value);
        return withValue(arguments_[0], reducedValue);
      }
      if (functionName === 'clamp' && arguments_.length === 3)
        return withValue(
          arguments_[0],
          Math.max(arguments_[0].value, Math.min(arguments_[1].value, arguments_[2].value)),
        );
      if (functionName === 'abs' && arguments_.length === 1)
        return withValue(arguments_[0], Math.abs(arguments_[0].value));
      if (functionName === 'sign' && arguments_.length === 1)
        return scalar(Math.sign(arguments_[0].value));
      if ((functionName === 'mod' || functionName === 'rem') && arguments_.length === 2) {
        const [dividend, divisor] = arguments_;
        if (divisor.value === 0) throw new Error('zero divisor');
        const quotient = dividend.value / divisor.value;
        return withValue(
          dividend,
          dividend.value -
            divisor.value * (functionName === 'mod' ? Math.floor(quotient) : Math.trunc(quotient)),
        );
      }
      if (functionName === 'round' && arguments_.length >= 1 && arguments_.length <= 2) {
        const [value, interval = withValue(arguments_[0], 1)] = arguments_;
        if (interval.value === 0) throw new Error('zero interval');
        const ratio = value.value / interval.value;
        const rounded =
          roundStrategy === 'up'
            ? Math.ceil(ratio)
            : roundStrategy === 'down'
              ? Math.floor(ratio)
              : roundStrategy === 'to-zero'
                ? Math.trunc(ratio)
                : Math.floor(ratio + 0.5);
        return withValue(value, rounded * interval.value);
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
      )
        return scalar(Math[functionName](angleInRadians(arguments_[0])));
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
        const [, start, end] = arguments_;
        if (start.value === end.value) throw new Error('empty progress range');
        const ratio = (arguments_[0].value - start.value) / (end.value - start.value);
        return scalar(Math.min(1, Math.max(0, ratio)));
      }
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
  for (const character of expression) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (depth > 512) return true;
  }
  return false;
}

function resolveStaticNumber(value) {
  const expression = collapseSimpleParenthesisChain(flattenCalcFunctions(value));
  if (exceedsStaticAnalysisDepth(expression)) return staticAnalysisTooComplex;
  const evaluated = evaluateConstantArithmetic(expression);
  return evaluated === null ? null : Math.floor(evaluated + 0.5);
}

export function decodeCssEscapes(value) {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      output += value[index];
      continue;
    }

    const nextCharacter = value[index + 1];
    if (nextCharacter === undefined || /[\n\f\r]/.test(nextCharacter)) {
      output += value[index];
      continue;
    }
    if (!/[0-9a-f]/i.test(nextCharacter)) {
      output += nextCharacter;
      index += 1;
      continue;
    }

    let hexEnd = index + 1;
    while (hexEnd < value.length && hexEnd <= index + 6 && /[0-9a-f]/i.test(value[hexEnd]))
      hexEnd += 1;
    const codePointValue = Number.parseInt(value.slice(index + 1, hexEnd), 16);
    output +=
      codePointValue === 0 || codePointValue > 0x10ffff
        ? '\ufffd'
        : String.fromCodePoint(codePointValue);
    if (value[hexEnd] === '\r' && value[hexEnd + 1] === '\n') hexEnd += 2;
    else if (isCssWhitespace(value[hexEnd])) hexEnd += 1;
    index = hexEnd - 1;
  }
  return output;
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
      if (codePoint === 0x2c) output += '\uE000';
      else if (codePoint === 0x28) output += '\uE001';
      else if (codePoint === 0x29) output += '\uE002';
      else if ([0x09, 0x0a, 0x0c, 0x0d, 0x20].includes(codePoint)) output += '\uE003';
      else output += value.slice(index, escapeEnd);
      index = escapeEnd - 1;
      continue;
    }

    if (nextCharacter === ',') output += '\uE000';
    else if (nextCharacter === '(') output += '\uE001';
    else if (nextCharacter === ')') output += '\uE002';
    else if (nextCharacter === ' ' || nextCharacter === '\t') output += '\uE003';
    else output += value.slice(index, index + 2);
    index += 1;
  }
  return output;
}

export function isCssIdentifierCharacter(character) {
  return character !== undefined && /[\w\u0080-\uFFFF-]/.test(character);
}

export function isStaticallyNegative(value) {
  const resolved = resolveStaticNumber(value);
  return (
    (resolved === staticAnalysisTooComplex &&
      !/(?:^|[^\w\u0080-\uFFFF-])(?:var|env|attr)\(/i.test(value)) ||
    (resolved !== null && resolved !== staticAnalysisTooComplex && resolved < 0)
  );
}

export function isStaticallyMagicNumber(value) {
  const resolved = resolveStaticNumber(value);
  return (
    (resolved === staticAnalysisTooComplex &&
      !/(?:^|[^\w\u0080-\uFFFF-])(?:var|env|attr)\(/i.test(value)) ||
    resolved === 9999
  );
}

export function isStaticallyZero(value) {
  return resolveStaticNumber(value) === 0;
}
