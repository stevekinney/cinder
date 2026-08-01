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
const fallbackFunctionPattern = /(?:var|env|attr)\(/iy;

function isCssWhitespace(character) {
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
    while (/[a-z-]/i.test(peek() ?? '')) index += 1;
    if (index !== functionStart) {
      const functionName = expression.slice(functionStart, index).toLowerCase();
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
    return index === expression.length && result.units.size === 0 && Number.isFinite(result.value)
      ? result.value
      : null;
  } catch {
    return null;
  }
}

function flattenCalcFunctions(value) {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const calcMatch = /^(?:-webkit-)?calc\(/i.exec(value.slice(index));
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

function resolveStaticNumber(value) {
  const evaluated = evaluateConstantArithmetic(flattenCalcFunctions(value));
  return evaluated === null ? null : Math.floor(evaluated + 0.5);
}

export function decodeCssEscapes(value) {
  return value
    .replaceAll(/\\([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?/gi, (_, codePoint) => {
      const codePointValue = Number.parseInt(codePoint, 16);
      return codePointValue > 0x10ffff ? '\ufffd' : String.fromCodePoint(codePointValue);
    })
    .replaceAll(/\\(.)/g, '$1');
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

function trimCssWhitespaceRange(value, start, end) {
  while (start < end && isCssWhitespace(value[start])) start += 1;
  while (end > start && isCssWhitespace(value[end - 1])) end -= 1;
  return { start, end };
}

// Parse every var()/env()/attr() fallback in one pass with an explicit parentheses
// stack. Each closed function is resolved bottom-up by substituting the
// fallback paths of direct nested functions, so hostile nesting cannot exhaust
// the JavaScript call stack and enclosing arithmetic can still be evaluated.
function fallbackCandidates(value) {
  const candidates = [];
  const parentheses = [];
  const fallbackFrames = [];

  for (let index = 0; index < value.length; index += 1) {
    fallbackFunctionPattern.lastIndex = index;
    const functionMatch = fallbackFunctionPattern.exec(value);
    const previousCharacter = value[index - 1];
    if (functionMatch && !isCssIdentifierCharacter(previousCharacter)) {
      const nearestFunction = fallbackFrames.at(-1);
      const frame = {
        type: 'fallback',
        start: index,
        openIndex: index + functionMatch[0].length - 1,
        commaIndex: -1,
        children: [],
        resolvedFallback: null,
      };
      if (nearestFunction && nearestFunction.commaIndex !== -1)
        nearestFunction.children.push(frame);
      parentheses.push(frame);
      fallbackFrames.push(frame);
      index = frame.openIndex;
      continue;
    }

    if (value[index] === '(') {
      parentheses.push({ type: 'group' });
      continue;
    }
    if (value[index] === ',') {
      const frame = parentheses.at(-1);
      if (frame?.type === 'fallback' && frame.commaIndex === -1) frame.commaIndex = index;
      continue;
    }
    if (value[index] !== ')') continue;

    const frame = parentheses.pop();
    if (frame?.type !== 'fallback') continue;
    fallbackFrames.pop();
    frame.end = index + 1;
    if (frame.commaIndex === -1) continue;

    const fallbackRange = trimCssWhitespaceRange(value, frame.commaIndex + 1, index);
    const rawFallback = value.slice(fallbackRange.start, fallbackRange.end);
    if (frame.children.some((child) => child.resolvedFallback === null)) {
      candidates.push({ rawFallback, resolvedFallback: null });
      continue;
    }

    const [onlyChild] = frame.children;
    if (
      frame.children.length === 1 &&
      onlyChild.start === fallbackRange.start &&
      onlyChild.end === fallbackRange.end
    ) {
      frame.resolvedFallback = onlyChild.resolvedFallback;
    } else {
      frame.resolvedFallback = rawFallback;
      for (const child of frame.children.toReversed()) {
        const relativeStart = child.start - fallbackRange.start;
        const relativeEnd = child.end - fallbackRange.start;
        frame.resolvedFallback =
          frame.resolvedFallback.slice(0, relativeStart) +
          `(${child.resolvedFallback})` +
          frame.resolvedFallback.slice(relativeEnd);
      }
    }
    candidates.push({ rawFallback, resolvedFallback: frame.resolvedFallback });
  }

  return candidates;
}

export function isStaticallyNegative(value) {
  const resolved = resolveStaticNumber(value);
  return resolved !== null && resolved < 0;
}

export function isStaticallyMagicNumber(value) {
  const resolved = resolveStaticNumber(value);
  return resolved !== null && resolved === 9999;
}

export function bannedFallback(value) {
  const protectedValue = protectCssSyntaxEscapes(value);
  for (const { rawFallback, resolvedFallback } of fallbackCandidates(
    decodeCssEscapes(protectedValue),
  )) {
    if (
      resolvedFallback !== null &&
      (isStaticallyNegative(resolvedFallback) || isStaticallyMagicNumber(resolvedFallback))
    )
      return rawFallback;
  }
  return undefined;
}
