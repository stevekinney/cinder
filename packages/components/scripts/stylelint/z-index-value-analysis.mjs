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
const signFunctionPattern = /sign\(/iy;
const substitutionFunctionPattern = /(?:var|env|attr)\(/iy;
const urlFunctionPattern = /url\(/iy;
const commutativeSymbolicOperations = new Set(['+', 'hypot', 'max', 'min']);
const maximumStaticSymbolicIdentityWork = 131_072;
const staticAnalysisTooComplex = Symbol('static-analysis-too-complex');
const staticAnalysisInvalid = Symbol('static-analysis-invalid');
const unboundedClampEndpoint = Symbol('unbounded-clamp-endpoint');

// CSS preprocessing replaces literal U+0000 with U+FFFD before tokenization,
// so U+0000 cannot collide with a source identifier after normalization.
export const cssCommentMaskCharacter = '\u0000';

export function isCssWhitespace(character) {
  return (
    character === ' ' ||
    character === '\t' ||
    character === '\n' ||
    character === '\f' ||
    character === '\r'
  );
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

export function unquotedUrlTokenEnd(value, start) {
  const firstCharacter = value.charCodeAt(start) | 0x20;
  if (firstCharacter !== 0x75) return undefined;
  urlFunctionPattern.lastIndex = start;
  const match = urlFunctionPattern.exec(value);
  const previousCharacter = value[start - 1];
  if (
    !match ||
    isCssIdentifierCharacter(previousCharacter) ||
    previousCharacter === '#' ||
    previousCharacter === '@'
  )
    return undefined;

  let index = start + match[0].length;
  while (isCssWhitespace(value[index])) index += 1;
  if (value[index] === '"' || value[index] === "'") return undefined;
  for (; index < value.length; index += 1) {
    if (value[index] === '\\' && value[index + 1] !== undefined) {
      if (value[index + 1] === '\r' && value[index + 2] === '\n') index += 2;
      else index += 1;
      continue;
    }
    if (value[index] === ')') return index;
  }
  return value.length - 1;
}

function hasActualSubstitutionFunction(value) {
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
    const firstCharacter = value.charCodeAt(index) | 0x20;
    if (firstCharacter !== 0x76 && firstCharacter !== 0x65 && firstCharacter !== 0x61) continue;
    substitutionFunctionPattern.lastIndex = index;
    const match = substitutionFunctionPattern.exec(value);
    const previousCharacter = value[index - 1];
    if (
      match &&
      !isCssIdentifierCharacter(previousCharacter) &&
      previousCharacter !== '#' &&
      previousCharacter !== '@'
    )
      return true;
  }
  return false;
}

// CSS numeric tokens spell only positive zero; generated arithmetic can still
// produce negative zero that nested functions must preserve.
function scalar(value, isLiteralZero = false) {
  return { value, units: new Map(), symbolicFactors: new Map(), isLiteralZero };
}

function withValue(source, value) {
  return {
    value,
    units: new Map(source.units),
    symbolicFactors: new Map(source.symbolicFactors),
    isLiteralZero: false,
  };
}

function normalizedDimension(unit) {
  const relativeUnitName = unit.startsWith('unit:') ? unit.slice(5) : undefined;
  return unit === 'dimension:length' || relativeLengthUnitNames.has(relativeUnitName)
    ? 'dimension:length'
    : unit;
}

function normalizedUnits(source) {
  const units = new Map();
  for (const [unit, exponent] of source) {
    const dimension = normalizedDimension(unit);
    const combined = (units.get(dimension) ?? 0) + exponent;
    if (combined === 0) units.delete(dimension);
    else units.set(dimension, combined);
  }
  return units;
}

function sameUnits(left, right) {
  const leftUnits = normalizedUnits(left.units);
  const rightUnits = normalizedUnits(right.units);
  if (leftUnits.size !== rightUnits.size) return false;
  return [...leftUnits].every(([unit, exponent]) => rightUnits.get(unit) === exponent);
}

function combineUnits(left, right, direction) {
  const units = normalizedUnits(left.units);
  for (const [unit, exponent] of normalizedUnits(right.units)) {
    const combined = (units.get(unit) ?? 0) + direction * exponent;
    if (combined === 0) units.delete(unit);
    else units.set(unit, combined);
  }
  return units;
}

function sameSymbolicFactors(left, right) {
  if (left.symbolicFactors.size !== right.symbolicFactors.size) return false;
  return [...left.symbolicFactors].every(
    ([factor, exponent]) => right.symbolicFactors.get(factor) === exponent,
  );
}

function combineSymbolicFactors(left, right, direction) {
  const factors = new Map(left.symbolicFactors);
  for (const [factor, exponent] of right.symbolicFactors) {
    const combined = (factors.get(factor) ?? 0) + direction * exponent;
    if (combined === 0) factors.delete(factor);
    else factors.set(factor, combined);
  }
  return factors;
}

function angleInRadians(value) {
  if (value.units.size === 0) return value.value;
  if (value.units.size === 1 && value.units.get('dimension:angle') === 1)
    return (value.value * Math.PI) / 180;
  throw new Error('expected a number or angle');
}

function angleInDegrees(value) {
  return {
    value: (value * 180) / Math.PI,
    units: new Map([['dimension:angle', 1]]),
    symbolicFactors: new Map(),
    isLiteralZero: false,
  };
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

function numericIdentity(value) {
  if (Object.is(value, -0)) return '-0';
  return String(value);
}

function mapIdentity(values) {
  return [...values]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, exponent]) => `${key}:${exponent}`)
    .join(',');
}

function valueIdentity(value) {
  return `${numericIdentity(value.value)}|${mapIdentity(normalizedUnits(value.units))}|${mapIdentity(value.symbolicFactors)}`;
}

// Evaluate static CSS math while retaining enough type information for
// compatible units to cancel during division. Unknown units remain distinct,
// but identical units can still cancel without needing layout context.
function evaluateConstantArithmetic(expression) {
  let index = 0;
  let remainingSymbolicIdentityWork = maximumStaticSymbolicIdentityWork;
  const symbolicIdentities = new Map();

  function additiveIdentityTerms(value) {
    return (
      value.associativeAddends ??
      new Map([
        [
          `${mapIdentity(normalizedUnits(value.units))}|${mapIdentity(value.symbolicFactors)}`,
          value.value,
        ],
      ])
    );
  }

  function combinedAdditiveIdentityTerms(arguments_) {
    const terms = new Map();
    for (const argument of arguments_) {
      for (const [identity, coefficient] of additiveIdentityTerms(argument))
        terms.set(identity, (terms.get(identity) ?? 0) + coefficient);
    }
    for (const [identity, coefficient] of terms) {
      if (coefficient === 0) terms.delete(identity);
    }
    return terms;
  }

  function symbolicIdentity(operation, arguments_, argumentIdentities) {
    argumentIdentities ??= arguments_.map(valueIdentity);
    const key = `${operation}(${argumentIdentities.join(';')})`;
    let identity = symbolicIdentities.get(key);
    if (identity === undefined) {
      identity = `expression:${symbolicIdentities.size}`;
      symbolicIdentities.set(key, identity);
    }
    return identity;
  }

  function opaqueValue(operation, arguments_, units = arguments_[0]?.units ?? new Map()) {
    let associativeAddends;
    let argumentIdentities;
    if (operation === '+') {
      associativeAddends = combinedAdditiveIdentityTerms(arguments_);
      if (associativeAddends.size === 0)
        return {
          value: 0,
          units: normalizedUnits(units),
          symbolicFactors: new Map(),
          isLiteralZero: false,
          associativeAddends,
        };
      argumentIdentities = [...associativeAddends].map(
        ([identity, coefficient]) => `${numericIdentity(coefficient)}|${identity}`,
      );
    } else if (commutativeSymbolicOperations.has(operation)) {
      argumentIdentities = arguments_.map(valueIdentity);
    }
    if (argumentIdentities !== undefined) {
      if (argumentIdentities.length > remainingSymbolicIdentityWork) throw staticAnalysisTooComplex;
      remainingSymbolicIdentityWork -= argumentIdentities.length;
      argumentIdentities.sort();
    }
    const value = {
      value: 1,
      units: normalizedUnits(units),
      symbolicFactors: new Map([[symbolicIdentity(operation, arguments_, argumentIdentities), 1]]),
      isLiteralZero: false,
    };
    if (associativeAddends !== undefined) value.associativeAddends = associativeAddends;
    return value;
  }

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
    if (value === 0) value = 0;
    const unitStart = index;
    while (/[a-z%]/i.test(peek() ?? '')) index += 1;
    const unit = expression.slice(unitStart, index).toLowerCase();
    if (!unit) return scalar(value, value === 0);
    const conversion = canonicalUnitConversions.get(unit);
    if (conversion === undefined && unit !== '%' && !relativeLengthUnitNames.has(unit))
      throw new Error('unknown unit');
    const unitKey =
      conversion === undefined && relativeLengthUnitNames.has(unit)
        ? 'dimension:length'
        : conversion === undefined
          ? `unit:${unit}`
          : `dimension:${conversion.dimension}`;
    if (conversion !== undefined) value *= conversion.factor;
    return {
      value,
      units: new Map([[unitKey, 1]]),
      symbolicFactors: new Map(
        value !== 0 && relativeLengthUnitNames.has(unit) ? [[`relative-length:${unit}`, 1]] : [],
      ),
      isLiteralZero: value === 0,
    };
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
    const startsIdentifier =
      /[a-z]/i.test(peek() ?? '') ||
      (peek() === '-' && /[a-z-]/i.test(expression[index + 1] ?? ''));
    if (startsIdentifier) {
      index += 1;
      while (/[a-z0-9-]/i.test(peek() ?? '')) index += 1;
    }
    if (index !== functionStart) {
      const functionName = expression.slice(functionStart, index).toLowerCase();
      if (peek() !== '(') {
        if (functionName === 'e') return scalar(Math.E);
        if (functionName === 'pi') return scalar(Math.PI);
        if (functionName === 'infinity') return scalar(Infinity);
        if (functionName === '-infinity') return scalar(-Infinity);
        if (functionName === 'nan') return scalar(Number.NaN);
        throw new Error('expected function arguments');
      }
      index += 1;
      let roundStrategy = 'nearest';
      let progressIsUnclamped = false;
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
      } else if (functionName === 'progress') {
        skipSpace();
        const noClampMatch = /^no-clamp/i.exec(expression.slice(index));
        const noClampEnd = index + (noClampMatch?.[0].length ?? 0);
        if (noClampMatch && isCssWhitespaceOrComment(expression[noClampEnd])) {
          progressIsUnclamped = true;
          index = noClampEnd;
        }
      }
      const arguments_ = [];
      for (;;) {
        skipSpace();
        const clampEndpointCanBeUnbounded =
          functionName === 'clamp' && (arguments_.length === 0 || arguments_.length === 2);
        const noneMatch = clampEndpointCanBeUnbounded
          ? /^none/i.exec(expression.slice(index))
          : null;
        let noneEnd = index + (noneMatch?.[0].length ?? 0);
        while (isCssWhitespaceOrComment(expression[noneEnd])) noneEnd += 1;
        const noneIsEndpoint =
          noneMatch !== null && (expression[noneEnd] === ',' || expression[noneEnd] === ')');
        if (noneIsEndpoint) {
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
      const hasUnknownConversion = boundedArguments.some(
        (argument) => argument.symbolicFactors.size > 0,
      );
      const [[sharedConversionFactor, sharedConversionExponent] = []] =
        boundedArguments[0]?.symbolicFactors ?? [];
      if (
        (functionName === 'min' || functionName === 'max') &&
        boundedArguments.length > 0 &&
        boundedArguments[0].symbolicFactors.size === 1 &&
        sharedConversionFactor?.startsWith('relative-length:') &&
        sharedConversionExponent === 1 &&
        boundedArguments.every((argument) => sameSymbolicFactors(argument, boundedArguments[0]))
      ) {
        let reducedValue = boundedArguments[0].value;
        for (let argumentIndex = 1; argumentIndex < boundedArguments.length; argumentIndex += 1)
          reducedValue = Math[functionName](reducedValue, boundedArguments[argumentIndex].value);
        return withValue(boundedArguments[0], reducedValue);
      }
      if (
        functionName === 'abs' &&
        boundedArguments.length === 1 &&
        boundedArguments[0].symbolicFactors.size === 1 &&
        sharedConversionFactor?.startsWith('relative-length:') &&
        sharedConversionExponent === 1
      )
        return withValue(boundedArguments[0], Math.abs(boundedArguments[0].value));
      if (
        functionName === 'sign' &&
        boundedArguments.length === 1 &&
        boundedArguments[0].units.has('unit:%')
      )
        return opaqueValue(functionName, boundedArguments, new Map());
      if (hasUnknownConversion) {
        if (functionName === 'sign' || functionName === 'progress')
          return opaqueValue(
            functionName === 'progress' && progressIsUnclamped ? 'progress:no-clamp' : functionName,
            boundedArguments,
            new Map(),
          );
        if (
          functionName === 'abs' ||
          functionName === 'clamp' ||
          functionName === 'hypot' ||
          functionName === 'max' ||
          functionName === 'min' ||
          functionName === 'mod' ||
          functionName === 'rem' ||
          functionName === 'round'
        )
          return opaqueValue(
            functionName === 'clamp'
              ? `clamp:${arguments_
                  .map((argument) => (argument === unboundedClampEndpoint ? 'none' : 'value'))
                  .join(',')}`
              : functionName === 'round'
                ? `round:${roundStrategy}`
                : functionName,
            boundedArguments,
          );
        throw new Error('unknown conversion value');
      }
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
        if (start.value === end.value) {
          if (!progressIsUnclamped || value.value === start.value) return scalar(0);
          return scalar(value.value < start.value ? -Infinity : Infinity);
        }
        const ratio = (value.value - start.value) / (end.value - start.value);
        return scalar(progressIsUnclamped ? ratio : Math.min(1, Math.max(0, ratio)));
      }
      throw new Error('unsupported function');
    }
    return parseNumber();
  }

  function parseAtom() {
    return parsePrimary();
  }

  function parseTerm() {
    let value = parseAtom();
    for (;;) {
      skipSpace();
      const operator = peek();
      if (operator !== '*' && operator !== '/') return value;
      index += 1;
      const right = parseAtom();
      const numericValue = operator === '*' ? value.value * right.value : value.value / right.value;
      const symbolicFactors =
        numericValue === 0 && (operator === '*' || right.value !== 0)
          ? new Map()
          : combineSymbolicFactors(value, right, operator === '*' ? 1 : -1);
      value = {
        value: numericValue,
        units: combineUnits(value, right, operator === '*' ? 1 : -1),
        symbolicFactors,
        isLiteralZero: false,
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
      if (sameSymbolicFactors(value, right)) {
        const combinedValue = withValue(
          value,
          operator === '+' ? value.value + right.value : value.value - right.value,
        );
        if (operator === '+')
          combinedValue.associativeAddends = combinedAdditiveIdentityTerms([value, right]);
        value = combinedValue;
      } else value = opaqueValue(operator, [value, right], value.units);
    }
  }

  try {
    const result = parseExpression();
    skipSpace();
    if (index !== expression.length) return null;
    return Number.isNaN(result.value) ? staticAnalysisInvalid : result;
  } catch (error) {
    return error === staticAnalysisTooComplex ? staticAnalysisTooComplex : null;
  }
}

function flattenCalcFunctions(value) {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const firstCharacter = value.charCodeAt(index) | 0x20;
    if (
      firstCharacter !== 0x63 &&
      (firstCharacter !== 0x2d || (value.charCodeAt(index + 1) | 0x20) !== 0x77)
    ) {
      output += value[index];
      continue;
    }
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
    const urlTokenEnd = unquotedUrlTokenEnd(expression, index);
    if (urlTokenEnd !== undefined) {
      index = urlTokenEnd;
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (depth > 512) return true;
  }
  return false;
}

function resolveStaticArithmeticResult(value) {
  const expression = collapseSimpleParenthesisChain(flattenCalcFunctions(value));
  if (exceedsStaticAnalysisDepth(expression)) return staticAnalysisTooComplex;
  return evaluateConstantArithmetic(expression);
}

function resolveStaticValue(value) {
  const resolved = resolveStaticArithmeticResult(value);
  if (
    resolved === null ||
    resolved === staticAnalysisTooComplex ||
    resolved === staticAnalysisInvalid
  )
    return resolved === staticAnalysisInvalid ? null : resolved;
  return resolved.units.size === 0 && resolved.symbolicFactors.size === 0 ? resolved.value : null;
}

function resolveStaticNumber(value) {
  const evaluated = resolveStaticValue(value);
  return evaluated === null || evaluated === staticAnalysisTooComplex
    ? evaluated
    : Math.floor(evaluated + 0.5);
}

function closingParenthesisIndex(value, argumentStart) {
  let depth = 1;
  for (let index = argumentStart; index < value.length; index += 1) {
    if (value[index] === '"' || value[index] === "'") {
      index = quotedStringEnd(value, index);
      continue;
    }
    const urlTokenEnd = unquotedUrlTokenEnd(value, index);
    if (urlTokenEnd !== undefined) {
      index = urlTokenEnd;
      continue;
    }
    if (value[index] === '(') {
      depth += 1;
      if (depth > 512) return undefined;
    } else if (value[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return undefined;
}

function classifyRelativeLengthSignEndpoints(
  value,
  budget = { remaining: maximumStaticSymbolicIdentityWork },
  depth = 0,
) {
  if (depth > 512) return 'too-complex';
  const ranges = [];
  const groupIndexes = new Map();
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
    if ((value.charCodeAt(index) | 0x20) !== 0x73) continue;
    signFunctionPattern.lastIndex = index;
    const signMatch = signFunctionPattern.exec(value);
    const previousCharacter = value[index - 1];
    if (
      !signMatch ||
      isCssIdentifierCharacter(previousCharacter) ||
      previousCharacter === '#' ||
      previousCharacter === '@'
    )
      continue;
    const argumentStart = index + signMatch[0].length;
    const closeIndex = closingParenthesisIndex(value, argumentStart);
    if (closeIndex === undefined) return undefined;
    const argument = value.slice(argumentStart, closeIndex);
    const resolvedArgument = resolveStaticArithmeticResult(argument);
    const normalizedArgumentUnits =
      resolvedArgument &&
      resolvedArgument !== staticAnalysisTooComplex &&
      resolvedArgument !== staticAnalysisInvalid
        ? normalizedUnits(resolvedArgument.units)
        : new Map();
    const [[symbolicFactor, symbolicExponent] = []] =
      resolvedArgument &&
      resolvedArgument !== staticAnalysisTooComplex &&
      resolvedArgument !== staticAnalysisInvalid
        ? [...resolvedArgument.symbolicFactors]
        : [];
    if (
      !resolvedArgument ||
      resolvedArgument === staticAnalysisTooComplex ||
      resolvedArgument === staticAnalysisInvalid ||
      resolvedArgument.symbolicFactors.size !== 1 ||
      !symbolicFactor?.startsWith('relative-length:') ||
      symbolicExponent !== 1 ||
      normalizedArgumentUnits.size !== 1 ||
      normalizedArgumentUnits.get('dimension:length') !== 1 ||
      resolvedArgument.value === 0
    )
      continue;
    const identity = `${mapIdentity(normalizedArgumentUnits)}|${mapIdentity(
      resolvedArgument.symbolicFactors,
    )}`;
    let groupIndex = groupIndexes.get(identity);
    if (groupIndex === undefined) {
      groupIndex = groupIndexes.size;
      groupIndexes.set(identity, groupIndex);
    }
    ranges.push({
      end: closeIndex + 1,
      endpoints: [0, Math.sign(resolvedArgument.value)],
      groupIndex,
      start: index,
    });
    index = closeIndex;
  }
  if (ranges.length === 0) return undefined;
  const combinationCount = 2 ** groupIndexes.size;
  const requiredWork = combinationCount * value.length;
  if (
    !Number.isSafeInteger(combinationCount) ||
    !Number.isSafeInteger(requiredWork) ||
    requiredWork > budget.remaining
  )
    return 'too-complex';
  budget.remaining -= requiredWork;
  let reachesNegative = false;
  let reachesMagic = false;
  for (let combination = 0; combination < combinationCount; combination += 1) {
    const chunks = [];
    let cursor = 0;
    for (let rangeIndex = 0; rangeIndex < ranges.length; rangeIndex += 1) {
      const range = ranges[rangeIndex];
      chunks.push(value.slice(cursor, range.start));
      chunks.push(String(range.endpoints[(combination >> range.groupIndex) & 1]));
      cursor = range.end;
    }
    chunks.push(value.slice(cursor));
    const endpointExpression = chunks.join('');
    const endpoint = resolveStaticNumber(endpointExpression);
    if (typeof endpoint === 'number' && !Number.isNaN(endpoint)) {
      reachesNegative ||= endpoint < 0;
      reachesMagic ||= endpoint === 9999;
      continue;
    }
    const nestedClassification = classifyRelativeLengthSignEndpoints(
      endpointExpression,
      budget,
      depth + 1,
    );
    if (nestedClassification === 'too-complex') return nestedClassification;
    reachesNegative ||= nestedClassification === 'negative';
    reachesMagic ||= nestedClassification === 'magic';
  }
  if (reachesNegative) return 'negative';
  if (reachesMagic) return 'magic';
  return undefined;
}

export function decodeCssEscapes(value) {
  if (!value.includes('\\') && !value.includes('\u0000')) return value;
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

function appendMappedInspection(output, sourceRanges, inspection) {
  output.push(inspection.value);
  for (const sourceRange of inspection.sourceRanges) sourceRanges.push(sourceRange);
}

function escapedCssIdentifierEnd(value, start) {
  let index = start;
  while (index < value.length) {
    if (isCssIdentifierCharacter(value[index])) {
      index += 1;
      continue;
    }
    if (value[index] !== '\\') break;
    const nextCharacter = value[index + 1];
    if (nextCharacter === undefined || /[\n\f\r]/.test(nextCharacter)) break;
    if (!/[0-9a-f]/i.test(nextCharacter)) {
      index += 2;
      continue;
    }
    let hexEnd = index + 1;
    while (hexEnd < value.length && hexEnd <= index + 6 && /[0-9a-f]/i.test(value[hexEnd]))
      hexEnd += 1;
    if (value[hexEnd] === '\r' && value[hexEnd + 1] === '\n') index = hexEnd + 2;
    else index = hexEnd + (isCssWhitespace(value[hexEnd]) ? 1 : 0);
  }
  return index;
}

function literalSourceRanges(value) {
  return Array.from({ length: value.length }, (_, index) => ({ start: index, end: index + 1 }));
}

function decodeCssEscapesForInspection(value, baseRanges = literalSourceRanges(value)) {
  const output = [];
  const sourceRanges = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      appendMappedCharacter(
        output,
        sourceRanges,
        value[index] === '\u0000' ? '\ufffd' : value[index],
        baseRanges[index],
      );
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
  if (!value.includes('\\') && !value.includes('\u0000'))
    return { value, sourceRanges: literalSourceRanges(value) };
  const output = [];
  const sourceRanges = [];
  const baseRanges = literalSourceRanges(value);
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      appendMappedCharacter(
        output,
        sourceRanges,
        value[index] === '\u0000' ? '\ufffd' : value[index],
        baseRanges[index],
      );
      continue;
    }

    const nextCharacter = value[index + 1];
    if (nextCharacter === undefined) {
      appendMappedCharacter(output, sourceRanges, value[index], baseRanges[index]);
      continue;
    }

    if (/[\d.]/.test(value[index - 1] ?? '') && !/[\n\f\r]/.test(nextCharacter)) {
      const identifierEnd = escapedCssIdentifierEnd(value, index);
      const decodedIdentifier = decodeCssEscapesForInspection(
        value.slice(index, identifierEnd),
        baseRanges.slice(index, identifierEnd),
      );
      const unitName = decodedIdentifier.value.toLowerCase();
      if (canonicalUnitConversions.has(unitName) || relativeLengthUnitNames.has(unitName))
        appendMappedInspection(output, sourceRanges, decodedIdentifier);
      else
        appendMappedCharacter(output, sourceRanges, '\uE000', {
          start: baseRanges[index].start,
          end: baseRanges[identifierEnd - 1].end,
        });
      index = identifierEnd - 1;
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
        appendMappedSlice(output, sourceRanges, value, index, escapeEnd, baseRanges);
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
  if (!value.includes('\\')) return value;
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
  if (character === undefined) return false;
  const codePoint = character.charCodeAt(0);
  return (
    codePoint === 0x2d ||
    codePoint === 0x5f ||
    (codePoint >= 0x30 && codePoint <= 0x39) ||
    (codePoint >= 0x41 && codePoint <= 0x5a) ||
    (codePoint >= 0x61 && codePoint <= 0x7a) ||
    codePoint >= 0x80
  );
}

function hasNumericResultType(units) {
  const dimensionExponents = new Map();
  for (const [unit, exponent] of units) {
    const dimension = normalizedDimension(unit);
    const combinedExponent = (dimensionExponents.get(dimension) ?? 0) + exponent;
    if (combinedExponent === 0) dimensionExponents.delete(dimension);
    else dimensionExponents.set(dimension, combinedExponent);
  }
  return dimensionExponents.size === 0;
}

export function analyzeStaticLayerValue(value) {
  const arithmeticResult = resolveStaticArithmeticResult(value);
  if (arithmeticResult === staticAnalysisTooComplex)
    return { classification: 'too-complex', resultType: 'too-complex' };
  if (arithmeticResult === null || arithmeticResult === staticAnalysisInvalid)
    return { classification: 'unresolved', resultType: 'unresolved' };
  if (arithmeticResult.units.size > 0 || arithmeticResult.symbolicFactors.size > 0) {
    const relativeLengthSignClassification = classifyRelativeLengthSignEndpoints(value);
    if (relativeLengthSignClassification !== undefined)
      return {
        classification: relativeLengthSignClassification,
        resultType: relativeLengthSignClassification === 'too-complex' ? 'too-complex' : 'number',
      };
    return {
      classification: 'unresolved',
      resultType: hasNumericResultType(arithmeticResult.units) ? 'number' : 'non-number',
    };
  }
  const resolved = Math.floor(arithmeticResult.value + 0.5);
  if (resolved < 0) return { classification: 'negative', resultType: 'number' };
  if (resolved === 9999) return { classification: 'magic', resultType: 'number' };
  return { classification: 'safe', resultType: 'number' };
}

export function classifyStaticLayer(value) {
  return analyzeStaticLayerValue(value).classification;
}

export function evaluateStaticLayerNumber(value) {
  const resolved = resolveStaticNumber(value);
  return typeof resolved === 'number' && !Number.isNaN(resolved) ? resolved : undefined;
}

export function isStaticallyNegative(value) {
  const classification = classifyStaticLayer(value);
  return (
    (classification === 'too-complex' && !hasActualSubstitutionFunction(value)) ||
    classification === 'negative'
  );
}

export function isStaticallyMagicNumber(value) {
  const classification = classifyStaticLayer(value);
  return (
    (classification === 'too-complex' && !hasActualSubstitutionFunction(value)) ||
    classification === 'magic'
  );
}

export function isStaticallyZero(value) {
  return resolveStaticValue(value) === 0;
}

export function hasStaticallyZeroCoefficient(value) {
  const resolved = resolveStaticArithmeticResult(value);
  return (
    resolved !== null &&
    resolved !== staticAnalysisTooComplex &&
    resolved !== staticAnalysisInvalid &&
    resolved.value === 0
  );
}

export function isStaticallyInvalidArithmetic(value) {
  return resolveStaticArithmeticResult(value) === staticAnalysisInvalid;
}

export function isStaticallyNegativeZero(value) {
  return Object.is(resolveStaticValue(value), -0);
}

export function isStaticallyNonnegative(value) {
  const resolved = resolveStaticValue(value);
  return typeof resolved === 'number' && resolved >= 0;
}

export function isStaticallyNegativeBeforeIntegerRounding(value) {
  const resolved = resolveStaticValue(value);
  return typeof resolved === 'number' && resolved < 0;
}
