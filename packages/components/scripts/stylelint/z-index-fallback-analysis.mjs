import {
  analyzeStaticLayerValue,
  classifyStaticLayer,
  cssCommentMaskCharacter,
  evaluateStaticLayerNumber,
  hasStaticallyZeroCoefficient,
  isCssIdentifierCharacter,
  isCssWhitespace,
  isCssWhitespaceOrComment,
  isStaticallyInvalidArithmetic,
  isStaticallyNegativeBeforeIntegerRounding,
  isStaticallyNegativeZero,
  isStaticallyNonnegative,
  isStaticallyZero,
  normalizeCssEscapesForInspection,
  unquotedUrlTokenEnd,
} from './z-index-value-analysis.mjs';

const fallbackFunctionPattern = /(?:var|env|attr)\(/iy;
const fallbackResolutionTooComplex = Symbol('fallback-resolution-too-complex');
const fallbackResolutionWorkLimit = 8_000_000;
const divisorWitnessValues = ['1', '1px', '1deg', '1s', '1hz', '1dppx'];
const invalidCustomIdentKeywords = new Set([
  'default',
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'unset',
]);
const validAttrSyntaxTypeNames = new Set([
  'angle',
  'color',
  'custom-ident',
  'image',
  'integer',
  'length',
  'length-percentage',
  'number',
  'percentage',
  'resolution',
  'string',
  'time',
  'transform-function',
  'transform-list',
]);
const signedZeroSensitiveFunctionNames = new Set(['atan2', 'log', 'pow', 'sign']);
const substitutionFunctionNames = new Set(['attr', 'env', 'var']);
const signedCalcKeywordPattern = /[+-](?:e|infinity|nan|pi)(?![-_a-z\d])/iy;
const mathFunctionNames = new Set([
  '-webkit-calc',
  'abs',
  'acos',
  'asin',
  'atan',
  'atan2',
  'calc',
  'clamp',
  'cos',
  'exp',
  'hypot',
  'log',
  'max',
  'min',
  'mod',
  'pow',
  'progress',
  'rem',
  'round',
  'sign',
  'sin',
  'sqrt',
  'tan',
]);

function trimCssTriviaRange(value, start, end) {
  while (start < end && isCssWhitespaceOrComment(value[start])) start += 1;
  while (end > start && isCssWhitespaceOrComment(value[end - 1])) end -= 1;
  return { start, end };
}

function consumeResolutionWork(budget, amount) {
  if (amount > budget.remaining) return false;
  budget.remaining -= amount;
  return true;
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

function maskTokenizingComments(value) {
  const segments = [];
  let copyFrom = 0;
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
    if (value[index] !== '/' || value[index + 1] !== '*') continue;
    const closingDelimiterIndex = value.indexOf('*/', index + 2);
    const commentEnd = closingDelimiterIndex === -1 ? value.length : closingDelimiterIndex + 2;
    segments.push(value.slice(copyFrom, index));
    segments.push(cssCommentMaskCharacter.repeat(commentEnd - index));
    copyFrom = commentEnd;
    index = commentEnd - 1;
  }
  if (copyFrom === 0) return value;
  segments.push(value.slice(copyFrom));
  return segments.join('');
}

function resolveFrameExpression(
  frame,
  value,
  range,
  budget,
  unresolvedReplacement,
  replaceEveryChild = false,
) {
  if (frame.children.some((child) => child.resolvedFallback === fallbackResolutionTooComplex))
    return fallbackResolutionTooComplex;
  if (
    unresolvedReplacement === undefined &&
    frame.children.some((child) => child.resolvedFallback === null)
  )
    return null;

  const [onlyChild] = frame.children;
  if (frame.children.length === 1 && onlyChild.start === range.start && onlyChild.end === range.end)
    return onlyChild.resolvedFallback;

  const rawExpressionLength = range.end - range.start;
  if (!consumeResolutionWork(budget, rawExpressionLength)) return fallbackResolutionTooComplex;
  const rawExpression = value.slice(range.start, range.end);
  let resolvedExpression = rawExpression;
  for (let childIndex = frame.children.length - 1; childIndex >= 0; childIndex -= 1) {
    const child = frame.children[childIndex];
    const relativeStart = child.start - range.start;
    const relativeEnd = child.end - range.start;
    // Custom-property substitution splices a token stream directly into the
    // surrounding value; it neither adds grouping parentheses nor retokenizes
    // adjacent tokens. Separator whitespace preserves those token boundaries.
    const replacementValue = replaceEveryChild
      ? unresolvedReplacement
      : (child.resolvedFallback ?? unresolvedReplacement);
    const replacement = ` ${replacementValue} `;
    const nextLength =
      resolvedExpression.length - (relativeEnd - relativeStart) + replacement.length;
    if (!consumeResolutionWork(budget, nextLength)) return fallbackResolutionTooComplex;
    resolvedExpression =
      resolvedExpression.slice(0, relativeStart) +
      replacement +
      resolvedExpression.slice(relativeEnd);
  }
  return resolvedExpression;
}

function factorRangeAfter(value, start, end, budget) {
  if (!consumeResolutionWork(budget, (end - start) * 4)) return fallbackResolutionTooComplex;
  while (start < end && isCssWhitespaceOrComment(value[start])) start += 1;
  const factorStart = start;
  while (start < end && /[+-]/.test(value[start])) {
    start += 1;
    while (start < end && isCssWhitespaceOrComment(value[start])) start += 1;
  }
  let depth = 0;
  for (; start < end; start += 1) {
    const character = value[start];
    if (character === '(') depth += 1;
    else if (character === ')') {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && /[*/+\-,]/.test(character)) break;
  }
  while (start > factorStart && isCssWhitespaceOrComment(value[start - 1])) start -= 1;
  return { start: factorStart, end: start };
}

function factorAfter(value, start, end, budget) {
  const range = factorRangeAfter(value, start, end, budget);
  return range === fallbackResolutionTooComplex
    ? fallbackResolutionTooComplex
    : value.slice(range.start, range.end);
}

function factorRangeBefore(value, start, end, budget) {
  if (!consumeResolutionWork(budget, (end - start) * 4)) return fallbackResolutionTooComplex;
  while (end > start && isCssWhitespaceOrComment(value[end - 1])) end -= 1;
  const factorEnd = end;
  let depth = 0;
  for (end -= 1; end >= start; end -= 1) {
    const character = value[end];
    if (character === ')') depth += 1;
    else if (character === '(') {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && /[*/+\-,]/.test(character)) break;
  }
  return { start: end + 1, end: factorEnd };
}

function factorBefore(value, start, end, budget) {
  const range = factorRangeBefore(value, start, end, budget);
  return range === fallbackResolutionTooComplex
    ? fallbackResolutionTooComplex
    : value.slice(range.start, range.end).trim();
}

function multiplicativeTermBefore(value, start, end, budget) {
  if (!consumeResolutionWork(budget, (end - start) * 4)) return fallbackResolutionTooComplex;
  while (end > start && isCssWhitespaceOrComment(value[end - 1])) end -= 1;
  const termEnd = end;
  let depth = 0;
  for (end -= 1; end >= start; end -= 1) {
    const character = value[end];
    if (character === ')') depth += 1;
    else if (character === '(') {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && character === ',') break;
    else if (depth === 0 && (character === '+' || character === '-')) {
      let previousIndex = end;
      while (previousIndex > start && isCssWhitespaceOrComment(value[previousIndex - 1]))
        previousIndex -= 1;
      const previousCharacter = value[previousIndex - 1];
      if (
        previousCharacter !== undefined &&
        previousCharacter !== '(' &&
        !/[*/+\-,]/.test(previousCharacter)
      )
        break;
    }
  }
  return value.slice(end + 1, termEnd).trim();
}

function isPrecededByDivision(value, operandStart) {
  while (operandStart > 0 && isCssWhitespaceOrComment(value[operandStart - 1])) operandStart -= 1;
  return value[operandStart - 1] === '/';
}

function contextForOpeningParenthesis(
  value,
  openIndex,
  inheritedContext,
  inheritedMathContext,
  inheritedConsumerContext = inheritedContext,
) {
  let functionStart = openIndex;
  while (functionStart > 0 && isCssIdentifierCharacter(value[functionStart - 1]))
    functionStart -= 1;
  const functionPrefix = value[functionStart - 1];
  const isGroupingParenthesis = functionStart === openIndex;
  const functionName =
    functionPrefix === '#' || functionPrefix === '@'
      ? ''
      : value.slice(functionStart, openIndex).toLowerCase();
  const operandStart = isGroupingParenthesis ? openIndex : functionStart;
  const parentRequiresSignedZero = inheritedContext || isPrecededByDivision(value, operandStart);
  const inheritsParentGrammar =
    isGroupingParenthesis || substitutionFunctionNames.has(functionName);
  return {
    consumerRequiresSignedZero:
      inheritedConsumerContext || signedZeroSensitiveFunctionNames.has(functionName),
    functionStart,
    functionName,
    isGroupingParenthesis,
    mathContext:
      mathFunctionNames.has(functionName) || (inheritsParentGrammar && inheritedMathContext),
    parentRequiresSignedZero,
    signedZeroSensitiveContext:
      parentRequiresSignedZero || signedZeroSensitiveFunctionNames.has(functionName),
  };
}

function expressionRangeIsMultipliedByStaticZero(
  value,
  range,
  expressionStart,
  expressionEnd,
  budget,
) {
  let afterChild = expressionEnd;
  while (
    afterChild < range.end &&
    (isCssWhitespaceOrComment(value[afterChild]) || value[afterChild] === ')')
  )
    afterChild += 1;
  if (value[afterChild] === '*') {
    const factor = factorAfter(value, afterChild + 1, range.end, budget);
    if (factor === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
    if (factor !== undefined && isStaticallyZero(factor)) return true;
  }

  let beforeChild = expressionStart;
  while (
    beforeChild > range.start &&
    (isCssWhitespaceOrComment(value[beforeChild - 1]) || value[beforeChild - 1] === '(')
  )
    beforeChild -= 1;
  if (value[beforeChild - 1] !== '*') return false;
  const factor = multiplicativeTermBefore(value, range.start, beforeChild - 1, budget);
  if (factor === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
  return factor !== undefined && isStaticallyZero(factor);
}

function childIsMultipliedByStaticZero(value, range, child, budget) {
  if (child.signedZeroSensitiveContext) return false;
  const directResult = expressionRangeIsMultipliedByStaticZero(
    value,
    range,
    child.start,
    child.end,
    budget,
  );
  if (directResult === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
  if (directResult) return true;
  const groupingParent = child.parenthesisParent;
  if (
    groupingParent?.type !== 'group' ||
    groupingParent.end === undefined ||
    groupingParent.openIndex < range.start ||
    groupingParent.end > range.end ||
    !groupingParent.mathContext
  )
    return false;
  const expressionStart = groupingParent.isGroupingParenthesis
    ? groupingParent.openIndex
    : groupingParent.functionStart;
  return expressionRangeIsMultipliedByStaticZero(
    value,
    range,
    expressionStart,
    groupingParent.end,
    budget,
  );
}

function childIsEliminatedByZeroProduct(value, range, child, budget) {
  if (child.signedZeroSensitiveContext) return false;
  if (typeof child.resolvedFallback !== 'string') return false;
  const groupingParent = child.parenthesisParent;
  const groupedZeroProduct =
    groupingParent?.type === 'group' &&
    groupingParent.isGroupingParenthesis &&
    groupingParent.end !== undefined
      ? expressionRangeIsMultipliedByStaticZero(
          value,
          range,
          groupingParent.openIndex,
          groupingParent.end,
          budget,
        )
      : false;
  if (groupedZeroProduct === fallbackResolutionTooComplex) return false;
  if (groupedZeroProduct) return true;
  let afterChild = child.end;
  while (
    afterChild < range.end &&
    (isCssWhitespaceOrComment(value[afterChild]) || value[afterChild] === ')')
  )
    afterChild += 1;
  if (value[afterChild] === '*') {
    const factor = factorAfter(value, afterChild + 1, range.end, budget);
    if (factor === fallbackResolutionTooComplex) return false;
    if (
      factor !== undefined &&
      hasStaticallyZeroCoefficient(`calc(${child.resolvedFallback} * ${factor})`)
    )
      return true;
  }

  let beforeChild = child.start;
  while (
    beforeChild > range.start &&
    (isCssWhitespaceOrComment(value[beforeChild - 1]) || value[beforeChild - 1] === '(')
  )
    beforeChild -= 1;
  if (value[beforeChild - 1] !== '*') return false;
  const factor = multiplicativeTermBefore(value, range.start, beforeChild - 1, budget);
  if (factor === fallbackResolutionTooComplex) return false;
  return (
    factor !== undefined &&
    hasStaticallyZeroCoefficient(`calc(${factor} * ${child.resolvedFallback})`)
  );
}

function analyzeResolvedFallback(resolvedFallback) {
  if (resolvedFallback === fallbackResolutionTooComplex)
    return { classification: 'too-complex', resultType: 'too-complex' };
  return typeof resolvedFallback === 'string'
    ? analyzeStaticLayerValue(resolvedFallback)
    : { classification: 'unresolved', resultType: 'unresolved' };
}

function analyzeFrameExpression(frame, resolvedFallback, budget) {
  if (typeof resolvedFallback !== 'string') return analyzeResolvedFallback(resolvedFallback);
  if (resolvedFallback.length > budget.remaining)
    return { classification: 'too-complex', resultType: 'too-complex' };
  return hasBareOperatorStream(
    resolvedFallback,
    0,
    resolvedFallback.length,
    budget,
    frame.mathContext,
  ) ||
    (!frame.mathContext && isBareCalcOnlyConstant(resolvedFallback))
    ? { classification: 'unresolved', resultType: 'unresolved' }
    : analyzeResolvedFallback(resolvedFallback);
}

function validSubstitutionOperandRange(child, value, range, parenthesisPairs) {
  if (child.end === undefined) return undefined;
  const headerFrame = child.commaIndex === -1 ? { ...child, commaIndex: child.end - 1 } : child;
  if (!validSubstitutionHeader(headerFrame, value)) return undefined;

  let start = child.start;
  let end = child.end;
  const groupingParent = child.parenthesisParent;
  if (
    (groupingParent?.isGroupingParenthesis || groupingParent?.functionName === 'calc') &&
    groupingParent.end !== undefined &&
    value.slice(groupingParent.openIndex + 1, child.start).trim() === '' &&
    value.slice(child.end, groupingParent.end - 1).trim() === ''
  ) {
    start = groupingParent.isGroupingParenthesis
      ? groupingParent.openIndex
      : groupingParent.functionStart;
    end = groupingParent.end;
  }
  for (;;) {
    let openIndex = start;
    while (openIndex > range.start && isCssWhitespaceOrComment(value[openIndex - 1]))
      openIndex -= 1;
    let closeIndex = end;
    while (closeIndex < range.end && isCssWhitespaceOrComment(value[closeIndex])) closeIndex += 1;
    if (value[openIndex - 1] !== '(' || parenthesisPairs.get(openIndex - 1) !== closeIndex) break;
    start = openIndex - 1;
    end = closeIndex + 1;
  }
  return { start, end };
}

function expandedSubstitutionDivisorRange(
  child,
  frame,
  value,
  range,
  budget,
  parenthesisPairs,
  expandedRangeCache,
) {
  const directRange = validSubstitutionOperandRange(child, value, range, parenthesisPairs);
  if (directRange === undefined) return undefined;

  let directDivisionIndex = directRange.start;
  while (
    directDivisionIndex > range.start &&
    isCssWhitespaceOrComment(value[directDivisionIndex - 1])
  )
    directDivisionIndex -= 1;
  if (value[directDivisionIndex - 1] === '/') return directRange;

  const groupingParent = child.parenthesisParent;
  if (
    groupingParent?.type !== 'group' ||
    groupingParent.end === undefined ||
    (!groupingParent.isGroupingParenthesis && !mathFunctionNames.has(groupingParent.functionName))
  )
    return directRange;
  let containerStart = groupingParent.isGroupingParenthesis
    ? groupingParent.openIndex
    : groupingParent.functionStart;
  let containerEnd = groupingParent.end;
  for (;;) {
    let openIndex = containerStart;
    while (openIndex > range.start && isCssWhitespaceOrComment(value[openIndex - 1]))
      openIndex -= 1;
    let closeIndex = containerEnd;
    while (closeIndex < range.end && isCssWhitespaceOrComment(value[closeIndex])) closeIndex += 1;
    if (value[openIndex - 1] !== '(' || parenthesisPairs.get(openIndex - 1) !== closeIndex) break;
    containerStart = openIndex - 1;
    containerEnd = closeIndex + 1;
  }
  let divisionIndex = containerStart;
  while (divisionIndex > range.start && isCssWhitespaceOrComment(value[divisionIndex - 1]))
    divisionIndex -= 1;
  if (value[divisionIndex - 1] !== '/') return directRange;
  const containerKey = `${containerStart}:${containerEnd}`;
  if (expandedRangeCache.has(containerKey))
    return expandedRangeCache.get(containerKey) ?? directRange;

  const factorRange = factorRangeAfter(value, divisionIndex, range.end, budget);
  if (factorRange === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
  if (factorRange.start > child.start || factorRange.end < child.end) return directRange;

  const containedChildren = frame.children
    .filter((candidate) => candidate.start >= factorRange.start && candidate.end <= factorRange.end)
    .sort((left, right) => left.start - right.start);
  const witnesses = [];
  const distinctPossibleDivisors = new Set();
  const witnessAssignmentCount =
    divisorWitnessValues.length + (divisorWitnessValues.length - 1) * containedChildren.length;
  for (
    let witnessAssignmentIndex = 0;
    witnessAssignmentIndex < witnessAssignmentCount;
    witnessAssignmentIndex += 1
  ) {
    const possibleDivisorParts = [];
    let sourceIndex = factorRange.start;
    for (let childIndex = 0; childIndex < containedChildren.length; childIndex += 1) {
      const candidate = containedChildren[childIndex];
      const typedAssignmentIndex = witnessAssignmentIndex - divisorWitnessValues.length;
      const witnessValueIndex =
        witnessAssignmentIndex < divisorWitnessValues.length
          ? witnessAssignmentIndex
          : Math.floor(typedAssignmentIndex / containedChildren.length) + 1;
      const typedChildIndex = typedAssignmentIndex % containedChildren.length;
      const witness =
        witnessAssignmentIndex < divisorWitnessValues.length || childIndex === typedChildIndex
          ? divisorWitnessValues[witnessValueIndex]
          : '1';
      possibleDivisorParts.push(value.slice(sourceIndex, candidate.start), ` ${witness} `);
      sourceIndex = candidate.end;
    }
    possibleDivisorParts.push(value.slice(sourceIndex, factorRange.end));
    const possibleDivisor = possibleDivisorParts.join('');
    if (distinctPossibleDivisors.has(possibleDivisor)) continue;
    distinctPossibleDivisors.add(possibleDivisor);
    if (!consumeResolutionWork(budget, possibleDivisor.length)) return fallbackResolutionTooComplex;
    if (analyzeStaticLayerValue(possibleDivisor).resultType !== 'unresolved')
      witnesses.push(possibleDivisor);
  }
  if (witnesses.length > 0) {
    const expandedRange = { ...factorRange, witnesses };
    expandedRangeCache.set(containerKey, expandedRange);
    return expandedRange;
  }
  expandedRangeCache.set(containerKey, null);
  return directRange;
}

function zeroNumeratorQuotientEndpointAnalysis(frame, value, range, budget, parenthesisPairs) {
  let zeroQuotientRanges = [];
  const analyzedDivisorRanges = new Set();
  const expandedDivisorRangeCache = new Map();
  for (const divisor of frame.children) {
    const divisorRange = expandedSubstitutionDivisorRange(
      divisor,
      frame,
      value,
      range,
      budget,
      parenthesisPairs,
      expandedDivisorRangeCache,
    );
    if (divisorRange === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
    if (divisorRange === undefined) continue;
    const divisorRangeKey = `${divisorRange.start}:${divisorRange.end}`;
    if (analyzedDivisorRanges.has(divisorRangeKey)) continue;
    analyzedDivisorRanges.add(divisorRangeKey);

    let divisionIndex = divisorRange.start;
    while (divisionIndex > range.start && isCssWhitespaceOrComment(value[divisionIndex - 1]))
      divisionIndex -= 1;
    if (value[divisionIndex - 1] !== '/') continue;
    const numeratorRange = factorRangeBefore(value, range.start, divisionIndex - 1, budget);
    if (numeratorRange === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
    const precedingZeroQuotient = zeroQuotientRanges.find(
      (zeroQuotientRange) => zeroQuotientRange.end === numeratorRange.end,
    );
    if (precedingZeroQuotient) {
      precedingZeroQuotient.end = divisorRange.end;
      precedingZeroQuotient.signedZeroSensitive ||=
        divisor.parenthesisParent?.consumerRequiresSignedZero === true;
      continue;
    }
    const nestedZeroQuotients = zeroQuotientRanges.filter(
      (zeroQuotientRange) =>
        zeroQuotientRange.start >= numeratorRange.start &&
        zeroQuotientRange.end <= numeratorRange.end,
    );
    const numeratorReplacements = nestedZeroQuotients.map((zeroQuotientRange) => ({
      start: zeroQuotientRange.start,
      end: zeroQuotientRange.end,
      value: ' 0 ',
    }));
    for (const numeratorChild of frame.children) {
      if (
        numeratorChild.start < numeratorRange.start ||
        numeratorChild.end > numeratorRange.end ||
        numeratorReplacements.some(
          (replacement) =>
            numeratorChild.start >= replacement.start && numeratorChild.end <= replacement.end,
        ) ||
        typeof numeratorChild.resolvedFallback !== 'string'
      )
        continue;
      numeratorReplacements.push({
        start: numeratorChild.start,
        end: numeratorChild.end,
        value: ` ${numeratorChild.resolvedFallback} `,
      });
    }
    let numerator = value.slice(numeratorRange.start, numeratorRange.end);
    for (const replacement of numeratorReplacements.sort(
      (left, right) => right.start - left.start,
    )) {
      const replacementStart = replacement.start - numeratorRange.start;
      const replacementEnd = replacement.end - numeratorRange.start;
      numerator =
        numerator.slice(0, replacementStart) + replacement.value + numerator.slice(replacementEnd);
    }
    if (numeratorReplacements.length > 0 && !consumeResolutionWork(budget, numerator.length))
      return fallbackResolutionTooComplex;
    if (divisorRange.witnesses !== undefined) {
      let hasCompatibleWitness = false;
      for (const witness of divisorRange.witnesses) {
        const quotientWitness = `calc(${numerator} / ${witness})`;
        if (!consumeResolutionWork(budget, quotientWitness.length))
          return fallbackResolutionTooComplex;
        if (analyzeStaticLayerValue(quotientWitness).resultType === 'number') {
          hasCompatibleWitness = true;
          break;
        }
      }
      if (!hasCompatibleWitness) {
        zeroQuotientRanges.push({
          start: numeratorRange.start,
          end: divisorRange.end,
          signedZeroSensitive: false,
          staticallyInvalid: true,
        });
        continue;
      }
    }
    if (hasStaticallyZeroCoefficient(numerator)) {
      zeroQuotientRanges = zeroQuotientRanges.filter(
        (zeroQuotientRange) => !nestedZeroQuotients.includes(zeroQuotientRange),
      );
      zeroQuotientRanges.push({
        start: numeratorRange.start,
        end: divisorRange.end,
        signedZeroSensitive: divisor.parenthesisParent?.consumerRequiresSignedZero === true,
      });
    }
  }
  if (zeroQuotientRanges.length === 0) return null;

  for (const zeroRange of zeroQuotientRanges) {
    for (;;) {
      let openIndex = zeroRange.start;
      while (openIndex > range.start && isCssWhitespaceOrComment(value[openIndex - 1]))
        openIndex -= 1;
      let closeIndex = zeroRange.end;
      while (closeIndex < range.end && isCssWhitespaceOrComment(value[closeIndex])) closeIndex += 1;
      if (value[openIndex - 1] !== '(' || parenthesisPairs.get(openIndex - 1) !== closeIndex) break;
      let containerStart = openIndex - 1;
      while (containerStart > range.start && isCssIdentifierCharacter(value[containerStart - 1]))
        containerStart -= 1;
      const containerFunctionName = value.slice(containerStart, openIndex - 1).toLowerCase();
      if (
        containerStart !== openIndex - 1 &&
        containerFunctionName !== 'calc' &&
        containerFunctionName !== 'sign'
      )
        break;
      zeroRange.start = containerStart;
      zeroRange.end = closeIndex + 1;
      if (containerFunctionName === 'sign') zeroRange.signedZeroSensitive = false;
    }
  }

  for (const zeroRange of zeroQuotientRanges) {
    for (;;) {
      const previousStart = zeroRange.start;
      const previousEnd = zeroRange.end;
      if (
        zeroRange.staticallyInvalid ||
        (!zeroRange.signedZeroSensitive && !isPrecededByDivision(value, zeroRange.start))
      ) {
        for (;;) {
          let operatorIndex = zeroRange.end;
          while (operatorIndex < range.end && isCssWhitespaceOrComment(value[operatorIndex]))
            operatorIndex += 1;
          const operator = value[operatorIndex];
          if (operator !== '*' && operator !== '/') break;
          const factorRange = factorRangeAfter(value, operatorIndex + 1, range.end, budget);
          if (factorRange === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
          if (factorRange.start === factorRange.end) break;
          if (
            !zeroRange.staticallyInvalid &&
            operator === '/' &&
            hasStaticallyZeroCoefficient(value.slice(factorRange.start, factorRange.end))
          ) {
            zeroRange.staticallyInvalid = true;
            zeroRange.signedZeroSensitive = false;
            zeroRange.end = factorRange.end;
            continue;
          }
          zeroRange.end = factorRange.end;
        }
        for (;;) {
          let operatorIndex = zeroRange.start;
          while (operatorIndex > range.start && isCssWhitespaceOrComment(value[operatorIndex - 1]))
            operatorIndex -= 1;
          const operator = value[operatorIndex - 1];
          if (operator !== '*' && !(zeroRange.staticallyInvalid && operator === '/')) break;
          const factorRange = factorRangeBefore(value, range.start, operatorIndex - 1, budget);
          if (factorRange === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
          if (factorRange.start === factorRange.end) break;
          zeroRange.start = factorRange.start;
        }
      }
      for (;;) {
        let openIndex = zeroRange.start;
        while (openIndex > range.start && isCssWhitespaceOrComment(value[openIndex - 1]))
          openIndex -= 1;
        let closeIndex = zeroRange.end;
        while (closeIndex < range.end && isCssWhitespaceOrComment(value[closeIndex]))
          closeIndex += 1;
        if (value[openIndex - 1] !== '(' || parenthesisPairs.get(openIndex - 1) !== closeIndex)
          break;
        zeroRange.start = openIndex - 1;
        zeroRange.end = closeIndex + 1;
      }
      if (zeroRange.start === previousStart && zeroRange.end === previousEnd) break;
    }
    if (!zeroRange.staticallyInvalid && isPrecededByDivision(value, zeroRange.start))
      zeroRange.signedZeroSensitive = true;
  }
  zeroQuotientRanges.sort((left, right) => left.start - right.start);
  const mergedZeroQuotientRanges = [];
  for (const zeroRange of zeroQuotientRanges) {
    const previousRange = mergedZeroQuotientRanges.at(-1);
    if (previousRange && zeroRange.start <= previousRange.end) {
      previousRange.end = Math.max(previousRange.end, zeroRange.end);
      previousRange.signedZeroSensitive ||= zeroRange.signedZeroSensitive;
      previousRange.staticallyInvalid ||= zeroRange.staticallyInvalid;
    } else mergedZeroQuotientRanges.push(zeroRange);
  }
  zeroQuotientRanges = mergedZeroQuotientRanges;
  if (zeroQuotientRanges.length === 0) return null;

  const suppressingZeroRanges = zeroQuotientRanges.filter(
    (zeroRange) => zeroRange.staticallyInvalid || !zeroRange.signedZeroSensitive,
  );
  if (zeroQuotientRanges.some((zeroRange) => zeroRange.staticallyInvalid))
    return { expression: null, ranges: suppressingZeroRanges, staticallyInvalid: true };
  const replacements = suppressingZeroRanges.map((zeroQuotientRange) => ({
    ...zeroQuotientRange,
    value: ' 0 ',
  }));
  const zeroProductRange = { ...range, frame };
  for (const child of frame.children) {
    if (
      suppressingZeroRanges.some(
        (zeroQuotientRange) =>
          child.start >= zeroQuotientRange.start && child.end <= zeroQuotientRange.end,
      )
    )
      continue;
    if (child.resolvedFallback === fallbackResolutionTooComplex)
      return fallbackResolutionTooComplex;
    if (typeof child.resolvedFallback === 'string') {
      replacements.push({
        start: child.start,
        end: child.end,
        value: ` ${child.resolvedFallback} `,
      });
      continue;
    }
    if (
      zeroQuotientRanges.some(
        (zeroQuotientRange) =>
          zeroQuotientRange.signedZeroSensitive &&
          child.start >= zeroQuotientRange.start &&
          child.end <= zeroQuotientRange.end,
      )
    ) {
      replacements.push({ start: child.start, end: child.end, value: ' 1 ' });
      continue;
    }
    const zeroProductResult = childIsMultipliedByStaticZero(value, zeroProductRange, child, budget);
    if (zeroProductResult === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
    if (!zeroProductResult) return null;
    replacements.push({ start: child.start, end: child.end, value: ' 0 ' });
  }

  let endpointExpression = value.slice(range.start, range.end);
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    const replacementStart = replacement.start - range.start;
    const replacementEnd = replacement.end - range.start;
    endpointExpression =
      endpointExpression.slice(0, replacementStart) +
      replacement.value +
      endpointExpression.slice(replacementEnd);
  }
  return consumeResolutionWork(budget, endpointExpression.length)
    ? { expression: endpointExpression, ranges: suppressingZeroRanges }
    : fallbackResolutionTooComplex;
}

function unwrapStaticContainer(value, range, parenthesisPairs) {
  let unwrappedRange = trimCssTriviaRange(value, range.start, range.end);
  for (;;) {
    let openIndex;
    if (value[unwrappedRange.start] === '(') openIndex = unwrappedRange.start;
    else {
      const calcMatch = /^(?:-webkit-)?calc\(/i.exec(
        value.slice(unwrappedRange.start, unwrappedRange.end),
      );
      if (!calcMatch) return unwrappedRange;
      openIndex = unwrappedRange.start + calcMatch[0].length - 1;
    }
    if (parenthesisPairs.get(openIndex) !== unwrappedRange.end - 1) return unwrappedRange;
    unwrappedRange = trimCssTriviaRange(value, openIndex + 1, unwrappedRange.end - 1);
  }
}

function adjacentTriviaContainsWhitespace(value, index, direction, range) {
  for (
    let cursor = index + direction;
    cursor >= range.start && cursor < range.end && isCssWhitespaceOrComment(value[cursor]);
    cursor += direction
  ) {
    if (isCssWhitespace(value[cursor])) return true;
  }
  return false;
}

function additiveNonNumberCandidateSuppression(frame, value, range, budget, parenthesisPairs) {
  const expressionRange = unwrapStaticContainer(value, range, parenthesisPairs);
  if (!consumeResolutionWork(budget, expressionRange.end - expressionRange.start)) return undefined;
  const termRanges = [];
  let termStart = expressionRange.start;
  for (let index = expressionRange.start; index < expressionRange.end; index += 1) {
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
      const closingIndex = parenthesisPairs.get(index);
      if (closingIndex === undefined || closingIndex >= expressionRange.end) return undefined;
      index = closingIndex;
      continue;
    }
    if (
      !/[+-]/.test(value[index]) ||
      !adjacentTriviaContainsWhitespace(value, index, -1, expressionRange) ||
      !adjacentTriviaContainsWhitespace(value, index, 1, expressionRange)
    )
      continue;
    termRanges.push(trimCssTriviaRange(value, termStart, index));
    termStart = index + 1;
  }
  if (termRanges.length === 0) return undefined;
  termRanges.push(trimCssTriviaRange(value, termStart, expressionRange.end));

  const suppressedCandidateRanges = [];
  let childIndex = 0;
  for (const termRange of termRanges) {
    while (frame.children[childIndex]?.end <= termRange.start) childIndex += 1;
    const children = [];
    while (frame.children[childIndex]?.start < termRange.end) {
      const child = frame.children[childIndex];
      if (child.start >= termRange.start && child.end <= termRange.end) children.push(child);
      childIndex += 1;
    }
    if (
      children.length > 1 ||
      children[0]?.unprovenBannedCandidates.some((candidate) => candidate.hasRuntimeSibling)
    )
      continue;
    const resolvedTerm = resolveFrameExpression({ ...frame, children }, value, termRange, budget);
    if (typeof resolvedTerm !== 'string' || !consumeResolutionWork(budget, resolvedTerm.length))
      continue;
    if (analyzeStaticLayerValue(resolvedTerm).resultType !== 'non-number') continue;
    if (children.length === 0) return { suppressesAllCandidates: true, suppressedCandidateRanges };
    suppressedCandidateRanges.push(termRange);
  }
  return suppressedCandidateRanges.length > 0
    ? { suppressesAllCandidates: false, suppressedCandidateRanges }
    : undefined;
}

function fallbackIndependentStaticArguments(frame, value, range, functionName, parenthesisPairs) {
  const trimmedRange = unwrapStaticContainer(value, range, parenthesisPairs);
  if (
    value.slice(trimmedRange.start, trimmedRange.start + functionName.length + 1).toLowerCase() !==
      `${functionName}(` ||
    value[trimmedRange.end - 1] !== ')'
  )
    return undefined;

  const argumentRanges = [];
  let argumentStart = trimmedRange.start + functionName.length + 1;
  for (let index = argumentStart; index < trimmedRange.end - 1; index += 1) {
    if (value[index] === '"' || value[index] === "'") index = quotedStringEnd(value, index);
    else if (value[index] === '(') {
      const closeIndex = parenthesisPairs.get(index);
      if (closeIndex === undefined || closeIndex >= trimmedRange.end) return undefined;
      index = closeIndex;
    } else if (value[index] === ')') {
      return undefined;
    } else if (value[index] === ',') {
      argumentRanges.push({ start: argumentStart, end: index });
      argumentStart = index + 1;
    }
  }
  argumentRanges.push({ start: argumentStart, end: trimmedRange.end - 1 });
  const arguments_ = argumentRanges.map((argumentRange) =>
    trimCssTriviaRange(value, argumentRange.start, argumentRange.end),
  );
  if (arguments_.some((argument) => argument.start === argument.end)) return undefined;

  let childIndex = 0;
  const staticArguments = argumentRanges.flatMap((argumentRange, argumentIndex) => {
    while (
      childIndex < frame.children.length &&
      frame.children[childIndex].end <= argumentRange.start
    )
      childIndex += 1;
    const child = frame.children[childIndex];
    const containsFallback =
      child !== undefined && child.start < argumentRange.end && child.end > argumentRange.start;
    if (containsFallback) return [];
    const argument = arguments_[argumentIndex];
    return [
      {
        index: argumentIndex,
        range: argument,
        value: value.slice(argument.start, argument.end),
      },
    ];
  });
  return {
    argumentCount: argumentRanges.length,
    argumentRanges: arguments_,
    staticArguments,
  };
}

function isValidProgressRange(frame, value, range, parenthesisPairs) {
  const parsedArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    range,
    'progress',
    parenthesisPairs,
  );
  if (parsedArguments?.argumentCount !== 3) return false;
  const firstArgument = value
    .slice(parsedArguments.argumentRanges[0].start, parsedArguments.argumentRanges[0].end)
    .trimStart();
  return !(
    firstArgument.slice(0, 8).toLowerCase() === 'no-clamp' &&
    !isCssIdentifierCharacter(firstArgument[8])
  );
}

function appendCanonicalWhitespace(output, nextCharacter) {
  const previousChunk = output[output.length - 1];
  const previousCharacter = previousChunk?.[previousChunk.length - 1];
  if (
    previousCharacter === undefined ||
    '([{,*/'.includes(previousCharacter) ||
    ')]},*/'.includes(nextCharacter)
  )
    return;
  output.push(' ');
}

function canonicalProgressArgument(value, range) {
  const output = [];
  let hasPendingWhitespace = false;
  for (let index = range.start; index < range.end; index += 1) {
    const character = value[index];
    if (character === cssCommentMaskCharacter) continue;
    if (isCssWhitespace(character)) {
      hasPendingWhitespace = true;
      continue;
    }
    if (hasPendingWhitespace) appendCanonicalWhitespace(output, character);
    hasPendingWhitespace = false;
    if (character === '"' || character === "'") {
      const stringEnd = quotedStringEnd(value, index);
      output.push(value.slice(index, stringEnd + 1));
      index = stringEnd;
      continue;
    }
    const identifierEnd = cssIdentifierTokenEnd(value, index);
    if (identifierEnd > index) {
      const identifier = value.slice(index, identifierEnd);
      let nextIndex = identifierEnd;
      while (value[nextIndex] === cssCommentMaskCharacter) nextIndex += 1;
      const lowerIdentifier = identifier.toLowerCase();
      output.push(
        value[nextIndex] === '(' &&
          (mathFunctionNames.has(lowerIdentifier) || substitutionFunctionNames.has(lowerIdentifier))
          ? lowerIdentifier
          : identifier,
      );
      index = identifierEnd - 1;
      continue;
    }
    output.push(character);
  }
  return output.join('');
}

function canonicalProgressRangeKey(frame, value, range, parenthesisPairs) {
  const parsedArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    range,
    'progress',
    parenthesisPairs,
  );
  if (parsedArguments?.argumentCount !== 3) return undefined;
  return parsedArguments.argumentRanges
    .map((argumentRange) => canonicalProgressArgument(value, argumentRange))
    .join('\u0001');
}

function additiveProgressDegrees(left, right) {
  const degrees = left;
  for (const [groupIndex, degree] of right)
    degrees.set(groupIndex, Math.max(degrees.get(groupIndex) ?? 0, degree));
  return degrees;
}

function multipliedProgressDegrees(left, right) {
  const degrees = new Map(left);
  for (const [groupIndex, degree] of right) {
    const combinedDegree = (degrees.get(groupIndex) ?? 0) + degree;
    if (combinedDegree > 1) throw new Error('nonlinear progress range');
    degrees.set(groupIndex, combinedDegree);
  }
  return degrees;
}

function progressExpressionIsMultilinear(
  value,
  range,
  progressRanges,
  progressRangeGroupIndexes,
  resolvedChildren,
  parenthesisPairs,
) {
  const progressAtoms = new Map(
    progressRanges.map((progressRange, index) => [
      progressRange.start,
      { end: progressRange.end, groupIndex: progressRangeGroupIndexes[index] },
    ]),
  );
  const constantAtoms = new Map(resolvedChildren.map((child) => [child.start, child.end]));
  let index = range.start;
  let depth = 0;

  function skipTrivia() {
    while (index < range.end && isCssWhitespaceOrComment(value[index])) index += 1;
  }

  function parseParenthesized(openIndex) {
    const closeIndex = parenthesisPairs.get(openIndex);
    if (closeIndex === undefined || closeIndex >= range.end || depth >= 512)
      throw new Error('unsupported progress expression');
    depth += 1;
    index = openIndex + 1;
    const degrees = parseExpression();
    skipTrivia();
    if (index !== closeIndex) throw new Error('invalid progress expression');
    index += 1;
    depth -= 1;
    return degrees;
  }

  function parsePrimary() {
    skipTrivia();
    while (value[index] === '+' || value[index] === '-') {
      index += 1;
      skipTrivia();
    }
    const progressAtom = progressAtoms.get(index);
    if (progressAtom) {
      index = progressAtom.end;
      return new Map([[progressAtom.groupIndex, 1]]);
    }
    const constantEnd = constantAtoms.get(index);
    if (constantEnd !== undefined) {
      index = constantEnd;
      return new Map();
    }
    if (value[index] === '(') return parseParenthesized(index);
    if (value[index] === '"' || value[index] === "'") {
      index = quotedStringEnd(value, index) + 1;
      return new Map();
    }
    const urlTokenEnd = unquotedUrlTokenEnd(value, index);
    if (urlTokenEnd !== undefined) {
      index = urlTokenEnd + 1;
      return new Map();
    }
    const identifierStart = index;
    const identifierEnd = cssIdentifierTokenEnd(value, index);
    if (identifierEnd > index) {
      const functionName = value.slice(index, identifierEnd).toLowerCase();
      index = identifierEnd;
      if (value[index] === '(') {
        if (functionName === 'calc' || functionName === '-webkit-calc')
          return parseParenthesized(index);
        const closeIndex = parenthesisPairs.get(index);
        if (closeIndex === undefined || closeIndex >= range.end)
          throw new Error('invalid static function');
        index = closeIndex + 1;
      }
      return new Map();
    }
    while (index < range.end) {
      const character = value[index];
      if (
        isCssWhitespaceOrComment(character) ||
        '()*/,'.includes(character) ||
        ((character === '+' || character === '-') &&
          !isNumericExponentSign(value, index, identifierStart))
      )
        break;
      index += 1;
    }
    if (index === identifierStart) throw new Error('expected static value');
    return new Map();
  }

  function parseTerm() {
    let degrees = parsePrimary();
    for (;;) {
      skipTrivia();
      const operator = value[index];
      if (operator !== '*' && operator !== '/') return degrees;
      index += 1;
      const right = parsePrimary();
      if (operator === '/' && right.size > 0) throw new Error('progress range in divisor');
      if (operator === '*') degrees = multipliedProgressDegrees(degrees, right);
    }
  }

  function parseExpression() {
    let degrees = parseTerm();
    for (;;) {
      skipTrivia();
      if (value[index] !== '+' && value[index] !== '-') return degrees;
      index += 1;
      degrees = additiveProgressDegrees(degrees, parseTerm());
    }
  }

  try {
    parseExpression();
    skipTrivia();
    return index === range.end;
  } catch {
    return false;
  }
}

function directBannedMathArgumentCandidates(
  frame,
  value,
  range,
  candidate,
  budget,
  parenthesisPairs,
) {
  for (const functionName of ['max', 'min', 'clamp', 'round']) {
    const parsedArguments = fallbackIndependentStaticArguments(
      frame,
      value,
      range,
      functionName,
      parenthesisPairs,
    );
    if (!parsedArguments) continue;
    if (functionName === 'clamp' && parsedArguments.argumentCount !== 3) return [];
    if (functionName !== 'round') {
      const staticResultTypes = new Set(
        parsedArguments.staticArguments.map(
          (argument) => analyzeStaticLayerValue(argument.value).resultType,
        ),
      );
      if (staticResultTypes.has('number') && staticResultTypes.has('non-number')) return [];
    }
    let candidateArguments;
    if (functionName === 'clamp')
      candidateArguments = parsedArguments.staticArguments.filter(
        (argument) => argument.index === 0 || argument.index === 2,
      );
    else if (functionName === 'round') {
      const firstArgument = value
        .slice(parsedArguments.argumentRanges[0].start, parsedArguments.argumentRanges[0].end)
        .replaceAll(cssCommentMaskCharacter, ' ')
        .trim()
        .toLowerCase();
      const hasStrategy = ['nearest', 'up', 'down', 'to-zero'].includes(firstArgument);
      const validArgumentCount = hasStrategy
        ? parsedArguments.argumentCount === 2 || parsedArguments.argumentCount === 3
        : parsedArguments.argumentCount === 1 || parsedArguments.argumentCount === 2;
      if (!validArgumentCount) return [];
      candidateArguments = parsedArguments.staticArguments.filter(
        (argument) => !hasStrategy || argument.index !== 0,
      );
      const staticResultTypes = new Set(
        candidateArguments.map((argument) => analyzeStaticLayerValue(argument.value).resultType),
      );
      if (staticResultTypes.has('unresolved')) return [];
      if (staticResultTypes.has('number') && staticResultTypes.has('non-number')) return [];
    } else candidateArguments = parsedArguments.staticArguments;
    const classificationWork = candidateArguments.reduce(
      (total, argument) => total + argument.value.length,
      0,
    );
    if (!consumeResolutionWork(budget, classificationWork))
      return [
        {
          ...candidate,
          resolvedFallback: fallbackResolutionTooComplex,
          resolvedClassification: 'too-complex',
        },
      ];
    return candidateArguments.flatMap((argument) => {
      const resolvedClassification = classifyStaticLayer(argument.value);
      return resolvedClassification === 'negative' || resolvedClassification === 'magic'
        ? [
            {
              fallbackIndex: argument.range.start,
              rawFallback: argument.value,
              resolvedFallback: argument.value,
              resolvedClassification,
              hasRuntimeSibling: true,
            },
          ]
        : [];
    });
  }
  return [];
}

function fallbackIndependentMathArgumentResultTypes(frame, value, range, parenthesisPairs) {
  for (const functionName of ['max', 'min', 'clamp', 'round']) {
    const parsedArguments = fallbackIndependentStaticArguments(
      frame,
      value,
      range,
      functionName,
      parenthesisPairs,
    );
    if (!parsedArguments) continue;
    if (functionName === 'clamp' && parsedArguments.argumentCount !== 3) return new Set();
    let staticArguments = parsedArguments.staticArguments;
    if (functionName === 'round') {
      const firstArgument = value
        .slice(parsedArguments.argumentRanges[0].start, parsedArguments.argumentRanges[0].end)
        .replaceAll(cssCommentMaskCharacter, ' ')
        .trim()
        .toLowerCase();
      const hasStrategy = ['nearest', 'up', 'down', 'to-zero'].includes(firstArgument);
      const validArgumentCount = hasStrategy
        ? parsedArguments.argumentCount === 2 || parsedArguments.argumentCount === 3
        : parsedArguments.argumentCount === 1 || parsedArguments.argumentCount === 2;
      if (!validArgumentCount) return new Set();
      staticArguments = parsedArguments.staticArguments.filter(
        (argument) => !hasStrategy || argument.index !== 0,
      );
    }
    return new Set(
      staticArguments
        .map((argument) => analyzeStaticLayerValue(argument.value).resultType)
        .filter((resultType) => resultType === 'number' || resultType === 'non-number'),
    );
  }
  return new Set();
}

function progressRangeCandidates(frame, value, range, candidate, budget, parenthesisPairs) {
  const unresolvedChildren = frame.children.filter((child) => child.resolvedFallback === null);
  const emptyAnalysis = { candidates: [], suppressedChild: undefined };
  if (unresolvedChildren.length === 0) return emptyAnalysis;
  const progressParents = [];
  const progressParentSet = new Set();
  for (const child of unresolvedChildren) {
    const progressParent = child.progressParent;
    if (
      progressParent?.end === undefined ||
      progressParent.functionStart < range.start ||
      progressParent.end > range.end
    )
      return emptyAnalysis;
    if (!progressParentSet.has(progressParent)) {
      progressParentSet.add(progressParent);
      progressParents.push(progressParent);
    }
  }
  const progressRanges = progressParents
    .map((parenthesis) => ({
      end: parenthesis.end,
      parenthesis,
      start: parenthesis.functionStart,
    }))
    .sort((left, right) => left.start - right.start);
  const tooComplexAnalysis = () => ({
    candidates: [
      {
        ...candidate,
        resolvedFallback: fallbackResolutionTooComplex,
        resolvedClassification: 'too-complex',
      },
    ],
    suppressedChild: undefined,
  });
  if (
    progressRanges.some(
      (progressRange) => progressRange.start < range.start || progressRange.end > range.end,
    ) ||
    progressRanges.some(
      (progressRange, index) => index > 0 && progressRanges[index - 1].end > progressRange.start,
    )
  )
    return tooComplexAnalysis();
  const childrenOutsideProgressRanges = frame.children.filter(
    (child) => !progressParentSet.has(child.progressParent),
  );
  if (childrenOutsideProgressRanges.some((child) => child.resolvedFallback === null))
    return emptyAnalysis;
  for (const progressRange of progressRanges) {
    if (!isValidProgressRange(frame, value, progressRange, parenthesisPairs)) return emptyAnalysis;
    const unsupportedParent = progressRange.parenthesis.unsupportedProgressRangeParent;
    if (
      unsupportedParent?.end !== undefined &&
      unsupportedParent.functionStart >= range.start &&
      unsupportedParent.end <= range.end
    )
      return childrenOutsideProgressRanges.length > 0 ? emptyAnalysis : tooComplexAnalysis();
  }
  const progressGroupIndexes = new Map();
  const progressGroupCounts = new Map();
  const progressRangeGroupIndexes = progressRanges.map((progressRange) => {
    const key =
      canonicalProgressRangeKey(frame, value, progressRange, parenthesisPairs) ??
      value.slice(progressRange.start, progressRange.end);
    const existingIndex = progressGroupIndexes.get(key);
    if (existingIndex !== undefined) {
      progressGroupCounts.set(existingIndex, (progressGroupCounts.get(existingIndex) ?? 1) + 1);
      return existingIndex;
    }
    const groupIndex = progressGroupIndexes.size;
    progressGroupIndexes.set(key, groupIndex);
    progressGroupCounts.set(groupIndex, 1);
    return groupIndex;
  });
  const resolvedChildren = childrenOutsideProgressRanges;
  if (resolvedChildren.some((child) => typeof child.resolvedFallback !== 'string'))
    return emptyAnalysis;
  if ([...progressGroupCounts.values()].some((count) => count > 1)) {
    if (!consumeResolutionWork(budget, range.end - range.start)) return tooComplexAnalysis();
    if (
      !progressExpressionIsMultilinear(
        value,
        range,
        progressRanges,
        progressRangeGroupIndexes,
        resolvedChildren,
        parenthesisPairs,
      )
    )
      return tooComplexAnalysis();
  }
  const replacementRanges = [
    ...progressRanges.map((progressRange, index) => ({
      ...progressRange,
      groupIndex: progressRangeGroupIndexes[index],
      type: 'progress',
    })),
    ...resolvedChildren.map((child) => ({
      end: child.end,
      replacement: ` ${child.resolvedFallback} `,
      start: child.start,
      type: 'fallback',
    })),
  ].sort((left, right) => left.start - right.start);
  const combinationCount = 2 ** progressGroupIndexes.size;
  const replacementLength = resolvedChildren.reduce(
    (total, child) => total + child.resolvedFallback.length + 2,
    0,
  );
  const generatedLength = combinationCount * (range.end - range.start + replacementLength);
  if (!Number.isSafeInteger(combinationCount) || !consumeResolutionWork(budget, generatedLength))
    return tooComplexAnalysis();
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let combination = 0; combination < combinationCount; combination += 1) {
    const chunks = [];
    let cursor = range.start;
    for (const replacementRange of replacementRanges) {
      chunks.push(value.slice(cursor, replacementRange.start));
      chunks.push(
        replacementRange.type === 'progress'
          ? String((combination >> replacementRange.groupIndex) & 1)
          : replacementRange.replacement,
      );
      cursor = replacementRange.end;
    }
    chunks.push(value.slice(cursor, range.end));
    const endpointValue = evaluateStaticLayerNumber(chunks.join(''));
    if (endpointValue === undefined) return emptyAnalysis;
    minimum = Math.min(minimum, endpointValue);
    maximum = Math.max(maximum, endpointValue);
  }
  const classifications = [];
  if (minimum < 0) classifications.push('negative');
  if (minimum <= 9999 && maximum >= 9999) classifications.push('magic');
  const candidateBearingResolvedChildren = resolvedChildren.filter(
    (child) => child.unprovenBannedCandidates.length > 0,
  );
  return {
    candidates: classifications.map((resolvedClassification) => ({
      ...candidate,
      resolvedClassification,
    })),
    suppressedChild:
      classifications.length === 0 &&
      resolvedChildren.length === 1 &&
      candidateBearingResolvedChildren.length === 1
        ? candidateBearingResolvedChildren[0]
        : undefined,
  };
}

function argumentWithFallbackPlaceholders(frame, value, range, budget) {
  if (!consumeResolutionWork(budget, range.end - range.start)) return undefined;
  const chunks = [];
  let cursor = range.start;
  for (const child of frame.children) {
    if (child.start < range.start || child.end > range.end) continue;
    chunks.push(value.slice(cursor, child.start), ' 0 ');
    cursor = child.end;
  }
  chunks.push(value.slice(cursor, range.end));
  return chunks.join('');
}

function hasFallbackIndependentSafeBound(
  frame,
  value,
  range,
  functionName,
  candidate,
  parenthesisPairs,
) {
  const parsedArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    range,
    functionName,
    parenthesisPairs,
  );
  if (!parsedArguments) return false;
  const staticArguments = new Map(
    parsedArguments.staticArguments.map((argument) => [argument.index, argument.value]),
  );
  return parsedArguments.argumentRanges.some((argumentRange, argumentIndex) => {
    const staticArgument = staticArguments.get(argumentIndex);
    if (staticArgument !== undefined)
      return functionName === 'min'
        ? classifyStaticLayer(`min(9999, ${staticArgument})`) === 'safe' &&
            !(frame.signedZeroSensitiveContext && isStaticallyNegativeZero(staticArgument))
        : candidate === 'magic'
          ? classifyStaticLayer(`max(9999, ${staticArgument})`) === 'safe'
          : classifyStaticLayer(staticArgument) === 'safe' &&
            isStaticallyNonnegative(staticArgument) &&
            !(frame.signedZeroSensitiveContext && isStaticallyNegativeZero(staticArgument));
    if (!isValidProgressRange(frame, value, argumentRange, parenthesisPairs)) return false;
    return functionName === 'min' || candidate === 'negative';
  });
}

function hasFallbackIndependentClampBound(
  frame,
  value,
  range,
  boundIndex,
  candidate,
  budget,
  parenthesisPairs,
) {
  const clampArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    range,
    'clamp',
    parenthesisPairs,
  );
  if (clampArguments?.argumentCount !== 3) return false;
  const centerExpression = argumentWithFallbackPlaceholders(
    frame,
    value,
    clampArguments.argumentRanges[1],
    budget,
  );
  if (centerExpression === undefined) return false;
  if (!['safe', 'negative', 'magic'].includes(classifyStaticLayer(centerExpression))) return false;
  if (candidate === 'magic') {
    const minimum = clampArguments.staticArguments.find((argument) => argument.index === 0);
    if (
      minimum !== undefined &&
      !/^none$/i.test(minimum.value) &&
      classifyStaticLayer(`max(9999, ${minimum.value})`) === 'safe'
    )
      return true;
  }
  const boundRange = clampArguments.argumentRanges[boundIndex];
  const bound = clampArguments.staticArguments.find((argument) => argument.index === boundIndex);
  const progressBound = isValidProgressRange(frame, value, boundRange, parenthesisPairs);
  if (!bound && !progressBound) return false;
  if (candidate === 'magic') {
    const minimum = clampArguments.staticArguments.find((argument) => argument.index === 0);
    if (!progressBound && classifyStaticLayer(`min(9999, ${bound.value})`) !== 'safe') return false;
    if (minimum === undefined) return false;
    if (/^none$/i.test(minimum.value)) return true;
    const maximumValue = progressBound ? '1' : bound.value;
    return classifyStaticLayer(`max(${minimum.value}, ${maximumValue})`) === 'safe';
  }
  return (
    progressBound ||
    (classifyStaticLayer(bound.value) === 'safe' &&
      isStaticallyNonnegative(bound.value) &&
      !(frame.signedZeroSensitiveContext && isStaticallyNegativeZero(bound.value)))
  );
}

function isPotentialBareOperandStart(value, start, end) {
  while (start < end && isCssWhitespaceOrComment(value[start])) start += 1;
  while (start < end && (value[start] === '+' || value[start] === '-')) {
    start += 1;
    while (start < end && isCssWhitespaceOrComment(value[start])) start += 1;
  }
  const character = value[start];
  if (character === '\uE000' || character === undefined) return false;
  return (
    /[\d.#@(["']/.test(character) || (isCssIdentifierCharacter(character) && character !== '\uE000')
  );
}

function isPotentialBareOperandEnd(value, start, end) {
  while (end > start && isCssWhitespaceOrComment(value[end - 1])) end -= 1;
  const character = value[end - 1];
  if (character === '\uE000' || character === undefined) return false;
  return /[\d%)\]"']/.test(character) || isCssIdentifierCharacter(character);
}

function isNumericExponentSign(value, index, rangeStart) {
  if (!/[eE]/.test(value[index - 1] ?? '') || !/\d/.test(value[index + 1] ?? '')) return false;
  let mantissaStart = index - 1;
  while (mantissaStart > rangeStart && /[\d.]/.test(value[mantissaStart - 1])) mantissaStart -= 1;
  const mantissa = value.slice(mantissaStart, index - 1);
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(mantissa)) return false;
  if (/[+-]/.test(value[mantissaStart - 1] ?? '')) mantissaStart -= 1;
  const precedingCharacter = value[mantissaStart - 1];
  return precedingCharacter !== '.' && !isCssIdentifierCharacter(precedingCharacter);
}

function isCssIdentifierStartCharacter(character) {
  return character !== undefined && /[A-Z_a-z\u0080-\uFFFF]/.test(character);
}

function cssIdentifierTokenEnd(value, start) {
  const firstCharacter = value[start];
  const startsIdentifier =
    isCssIdentifierStartCharacter(firstCharacter) ||
    (firstCharacter === '-' &&
      (value[start + 1] === '-' || isCssIdentifierStartCharacter(value[start + 1])));
  if (!startsIdentifier) return start;
  let end = start + 1;
  while (isCssIdentifierCharacter(value[end])) end += 1;
  return end;
}

function validAttrTypeSyntax(syntax) {
  syntax = syntax.trim();
  if (syntax === '*') return true;
  if (syntax[0] === '"' || syntax[0] === "'")
    return quotedStringEnd(syntax, 0) === syntax.length - 1;

  let index = 0;
  for (;;) {
    while (isCssWhitespaceOrComment(syntax[index])) index += 1;
    let supportsMultiplier = true;
    if (syntax[index] === '<') {
      const closeIndex = syntax.indexOf('>', index + 1);
      if (closeIndex === -1) return false;
      const typeName = syntax.slice(index + 1, closeIndex).toLowerCase();
      if (!validAttrSyntaxTypeNames.has(typeName)) return false;
      supportsMultiplier = typeName !== 'transform-list';
      index = closeIndex + 1;
    } else {
      const identifierEnd = cssIdentifierTokenEnd(syntax, index);
      if (identifierEnd === index) return false;
      index = identifierEnd;
    }
    if (syntax[index] === '#' || syntax[index] === '+') {
      if (!supportsMultiplier) return false;
      index += 1;
    }
    while (isCssWhitespaceOrComment(syntax[index])) index += 1;
    if (index === syntax.length) return true;
    if (syntax[index] !== '|') return false;
    index += 1;
    if (index === syntax.length) return false;
  }
}

function validSubstitutionHeader(frame, value) {
  const header = value
    .slice(frame.openIndex + 1, frame.commaIndex)
    .replaceAll(cssCommentMaskCharacter, ' ')
    .trim();
  const identifierEnd = cssIdentifierTokenEnd(header, 0);
  if (identifierEnd === 0) return false;
  if (frame.functionName === 'var')
    return header.startsWith('--') && identifierEnd === header.length;
  if (frame.functionName === 'env')
    return (
      !invalidCustomIdentKeywords.has(header.slice(0, identifierEnd).toLowerCase()) &&
      /^(?:\s+\+?\d+)*$/.test(header.slice(identifierEnd))
    );
  if (frame.functionName !== 'attr') return false;
  const attrType = header.slice(identifierEnd).trim();
  if (attrType === '' || attrType === '%') return true;
  if (cssIdentifierTokenEnd(attrType, 0) === attrType.length) return true;
  const typeMatch = /^type\(([^()]+)\)$/i.exec(attrType);
  if (!typeMatch) return false;
  return validAttrTypeSyntax(typeMatch[1]);
}

function hasInvalidEdgeOperator(value, start, end, allowWebkitCalcPrefix = false) {
  const range = trimCssTriviaRange(value, start, end);
  const firstCharacter = value[range.start];
  const lastCharacter = value[range.end - 1];
  const signedCalcKeyword = /^-infinity(?![-_a-z\d])/i.test(value.slice(range.start, range.end));
  if (firstCharacter === '*' || firstCharacter === '/') return true;
  if (
    (firstCharacter === '+' || firstCharacter === '-') &&
    !/\d/.test(value[range.start + 1] ?? '') &&
    !(value[range.start + 1] === '.' && /\d/.test(value[range.start + 2] ?? '')) &&
    !signedCalcKeyword &&
    !(
      allowWebkitCalcPrefix &&
      value
        .slice(range.start, range.start + 14)
        .toLowerCase()
        .startsWith('-webkit-calc(')
    )
  )
    return true;
  return (
    /[+\-*/]/.test(lastCharacter ?? '') && !(lastCharacter === '/' && value[range.end - 2] === '*')
  );
}

function hasBareOperatorStream(
  value,
  start = 0,
  end = value.length,
  budget,
  initialMathContext = false,
  detectEdgeOperators = false,
) {
  if (budget && !consumeResolutionWork(budget, end - start)) return false;
  const range = trimCssTriviaRange(value, start, end);
  if (value[range.start] === '(' && !initialMathContext) return true;
  if (
    !initialMathContext &&
    detectEdgeOperators &&
    hasInvalidEdgeOperator(value, range.start, range.end, true)
  )
    return true;
  const parenthesisContexts = [];
  for (let index = range.start; index < range.end; index += 1) {
    const character = value[index];
    if (character === '"' || character === "'") {
      index = quotedStringEnd(value, index);
      continue;
    }
    const urlTokenEnd = unquotedUrlTokenEnd(value, index);
    if (urlTokenEnd !== undefined) {
      index = urlTokenEnd;
      continue;
    }
    if (
      (character === '+' || character === '-') &&
      (parenthesisContexts.at(-1)?.mathContext ?? initialMathContext)
    ) {
      signedCalcKeywordPattern.lastIndex = index;
      const signedCalcKeyword = signedCalcKeywordPattern.exec(value)?.[0].toLowerCase();
      if (signedCalcKeyword !== undefined && signedCalcKeyword !== '-infinity') return true;
    }
    const identifierEnd = cssIdentifierTokenEnd(value, index);
    if (identifierEnd > index) {
      index = identifierEnd - 1;
      continue;
    }
    if (character === '(') {
      parenthesisContexts.push({
        ...contextForOpeningParenthesis(
          value,
          index,
          false,
          parenthesisContexts.at(-1)?.mathContext ?? initialMathContext,
        ),
        openIndex: index,
      });
    } else if (character === ')') {
      const context = parenthesisContexts.pop();
      if (
        detectEdgeOperators &&
        context?.mathContext === true &&
        (context.isGroupingParenthesis || mathFunctionNames.has(context.functionName)) &&
        hasInvalidEdgeOperator(value, context.openIndex + 1, index)
      )
        return true;
    } else if (
      character === ',' &&
      (parenthesisContexts.length === 0 ||
        parenthesisContexts.at(-1)?.isGroupingParenthesis ||
        parenthesisContexts.at(-1)?.functionName === 'calc' ||
        parenthesisContexts.at(-1)?.functionName === '-webkit-calc')
    )
      return true;
    else if (
      !substitutionFunctionNames.has(parenthesisContexts.at(-1)?.functionName) &&
      /[+\-*/]/.test(character)
    ) {
      let nextIndex = index + 1;
      while (nextIndex < range.end && isCssWhitespaceOrComment(value[nextIndex])) nextIndex += 1;
      if (character === '*' && value[nextIndex] === '*') return true;
      if ((parenthesisContexts.at(-1)?.mathContext ?? initialMathContext) === true) continue;
      let previousIndex = index - 1;
      while (previousIndex >= range.start && isCssWhitespaceOrComment(value[previousIndex]))
        previousIndex -= 1;
      const isExponentSign =
        previousIndex === index - 1 && isNumericExponentSign(value, index, range.start);
      if (
        !isExponentSign &&
        isPotentialBareOperandEnd(value, range.start, index) &&
        isPotentialBareOperandStart(value, index + 1, range.end)
      )
        return true;
    }
  }
  return false;
}

function hasAdjacentFallbackToken(frame, value, range, budget) {
  if (!consumeResolutionWork(budget, range.end - range.start)) return false;
  for (const child of frame.children) {
    if (child.start < range.start || child.end > range.end) continue;
    let beforeChild = child.start;
    while (beforeChild > range.start && isCssWhitespaceOrComment(value[beforeChild - 1]))
      beforeChild -= 1;
    const previousCharacter = beforeChild <= range.start ? undefined : value[beforeChild - 1];
    const progressParent = child.parenthesisParent;
    const hasNoClampProgressPrefix =
      progressParent?.functionName === 'progress' &&
      value
        .slice(progressParent.openIndex + 1, beforeChild)
        .replaceAll(cssCommentMaskCharacter, ' ')
        .trim()
        .toLowerCase() === 'no-clamp';
    if (
      previousCharacter !== undefined &&
      previousCharacter !== '\uE000' &&
      !hasNoClampProgressPrefix &&
      !/[,+\-*/(]/.test(previousCharacter)
    )
      return true;

    let afterChild = child.end;
    while (afterChild < range.end && isCssWhitespaceOrComment(value[afterChild])) afterChild += 1;
    const nextCharacter = afterChild >= range.end ? undefined : value[afterChild];
    if (
      nextCharacter !== undefined &&
      nextCharacter !== '\uE000' &&
      !/[,+\-*/)]/.test(nextCharacter)
    )
      return true;
  }
  return false;
}

function isBareCalcOnlyConstant(value) {
  return /^(?:e|pi|infinity|-infinity|nan)$/i.test(value.trim());
}

function negativeZeroIsSafeFinalLayer(frame, value, range, budget) {
  if (!frame.resolvedNegativeZero) return false;
  const candidateChildren = frame.children.filter(
    (child) => child.unprovenBannedCandidates.length > 0,
  );
  return (
    candidateChildren.length > 0 &&
    candidateChildren.every(
      (child) =>
        child.negativeZeroIsSafeFinalLayer ||
        childIsEliminatedByZeroProduct(value, range, child, budget),
    )
  );
}

function uniqueCandidatesByClassification(candidates) {
  const classifications = new Set();
  return candidates.filter((candidate) => {
    if (classifications.has(candidate.resolvedClassification)) return false;
    classifications.add(candidate.resolvedClassification);
    return true;
  });
}

function unprovenCandidatesForFrame(frame, value, range, candidate, budget, parenthesisPairs) {
  // Resolving every sibling fallback at once represents only one runtime path:
  // any sibling may instead use its defined custom-property value. Preserve a
  // candidate for every banned classification unless its contribution is safe
  // independently of that choice.
  const resolvedNegativeZero = frame.type === 'fallback' && frame.resolvedNegativeZero === true;
  const [onlyChild] = frame.children;
  const hasSingleChildWithEnclosingContext =
    frame.children.length === 1 && (onlyChild.start !== range.start || onlyChild.end !== range.end);
  if (frame.resolvedClassification === 'too-complex') return [candidate];
  if (
    frame.type === 'root' &&
    (frame.hasInvalidCommaStream === true ||
      hasBareOperatorStream(value, range.start, range.end, budget, false, true))
  )
    return [];
  if (
    hasSingleChildWithEnclosingContext &&
    typeof frame.resolvedFallback === 'string' &&
    isStaticallyInvalidArithmetic(frame.resolvedFallback)
  ) {
    const runtimeExpression = resolveFrameExpression(frame, value, range, budget, '1', true);
    if (typeof runtimeExpression === 'string' && isStaticallyInvalidArithmetic(runtimeExpression))
      return [];
  }
  if (
    frame.type === 'root' &&
    frame.children.length === 1 &&
    frame.resolvedResultType === 'non-number' &&
    !frame.children[0].unprovenBannedCandidates.some((childCandidate) =>
      Boolean(childCandidate.hasRuntimeSibling),
    )
  )
    return [];
  const additiveNonNumberSuppression =
    frame.resolvedClassification === 'unresolved'
      ? additiveNonNumberCandidateSuppression(frame, value, range, budget, parenthesisPairs)
      : undefined;
  if (isValidProgressRange(frame, value, range, parenthesisPairs)) return [];
  const nestedCandidatesAreHiddenByBareOperatorStream =
    frame.resolvedClassification === 'unresolved' &&
    frame.type !== 'root' &&
    (frame.hasInvalidCommaStream === true ||
      hasBareOperatorStream(value, range.start, range.end, budget, frame.mathContext, true) ||
      hasAdjacentFallbackToken(frame, value, range, budget));
  const zeroQuotientEndpoint =
    frame.resolvedClassification === 'unresolved'
      ? zeroNumeratorQuotientEndpointAnalysis(frame, value, range, budget, parenthesisPairs)
      : null;
  if (zeroQuotientEndpoint === fallbackResolutionTooComplex)
    return [
      {
        ...candidate,
        resolvedFallback: fallbackResolutionTooComplex,
        resolvedClassification: 'too-complex',
      },
    ];
  if (additiveNonNumberSuppression?.suppressesAllCandidates && zeroQuotientEndpoint === null)
    return [];
  const candidateIsSuppressedByZeroQuotient = (childCandidate) =>
    !resolvedNegativeZero &&
    zeroQuotientEndpoint?.ranges.some(
      (zeroRange) =>
        childCandidate.fallbackIndex >= zeroRange.start &&
        childCandidate.fallbackIndex < zeroRange.end,
    ) === true;
  const uneliminatedChildren = frame.children.filter(
    (child) =>
      child.unprovenBannedCandidates.length > 0 &&
      !nestedCandidatesAreHiddenByBareOperatorStream &&
      !(
        child.invalidFunctionParent?.end !== undefined &&
        child.invalidFunctionParent.functionStart >= range.start &&
        child.invalidFunctionParent.end <= range.end
      ) &&
      (resolvedNegativeZero ||
        (!child.unprovenBannedCandidates.every(candidateIsSuppressedByZeroQuotient) &&
          !childIsEliminatedByZeroProduct(value, range, child, budget))),
  );
  const candidateIsSuppressedByNonNumberTerm = (childCandidate) =>
    additiveNonNumberSuppression?.suppressedCandidateRanges.some(
      (suppressedRange) =>
        childCandidate.fallbackIndex >= suppressedRange.start &&
        childCandidate.fallbackIndex < suppressedRange.end,
    ) === true;
  const progressAnalysis = progressRangeCandidates(
    frame,
    value,
    range,
    candidate,
    budget,
    parenthesisPairs,
  );
  const childCandidates = uneliminatedChildren
    .filter((child) => child !== progressAnalysis.suppressedChild)
    .flatMap((child) => child.unprovenBannedCandidates)
    .filter(
      (childCandidate) =>
        !candidateIsSuppressedByNonNumberTerm(childCandidate) &&
        !candidateIsSuppressedByZeroQuotient(childCandidate),
    );
  const directArgumentCandidates =
    frame.resolvedClassification === 'unresolved'
      ? directBannedMathArgumentCandidates(
          frame,
          value,
          range,
          candidate,
          budget,
          parenthesisPairs,
        ).filter(
          (childCandidate) =>
            !candidateIsSuppressedByNonNumberTerm(childCandidate) &&
            !candidateIsSuppressedByZeroQuotient(childCandidate),
        )
      : [];
  const fallbackIndependentMathArgumentTypes = fallbackIndependentMathArgumentResultTypes(
    frame,
    value,
    range,
    parenthesisPairs,
  );
  const candidateConflictsWithStaticMathArgument = (candidateToCheck) => {
    if (typeof candidateToCheck.resolvedFallback !== 'string') return false;
    const resultType = analyzeStaticLayerValue(candidateToCheck.resolvedFallback).resultType;
    return (
      (resultType === 'number' && fallbackIndependentMathArgumentTypes.has('non-number')) ||
      (resultType === 'non-number' && fallbackIndependentMathArgumentTypes.has('number'))
    );
  };
  let runtimeZeroFallback = zeroQuotientEndpoint?.expression ?? null;
  if (
    frame.resolvedClassification === 'unresolved' &&
    runtimeZeroFallback === null &&
    zeroQuotientEndpoint?.staticallyInvalid !== true
  ) {
    if (frame.children.some((child) => child.resolvedFallback === null)) {
      const unresolvedChildren = frame.children.filter((child) => child.resolvedFallback === null);
      const zeroProductRange = { ...range, frame };
      let everyUnresolvedChildIsZeroed = true;
      for (const child of unresolvedChildren) {
        const zeroProductResult = childIsMultipliedByStaticZero(
          value,
          zeroProductRange,
          child,
          budget,
        );
        if (zeroProductResult === fallbackResolutionTooComplex)
          return [
            {
              ...candidate,
              resolvedFallback: fallbackResolutionTooComplex,
              resolvedClassification: 'too-complex',
            },
          ];
        if (!zeroProductResult) {
          everyUnresolvedChildIsZeroed = false;
          break;
        }
      }
      const runtimeZeroRange = unwrapStaticContainer(value, range, parenthesisPairs);
      const fallbackIsRoundFunction =
        value.slice(runtimeZeroRange.start, runtimeZeroRange.start + 6).toLowerCase() ===
          'round(' && parenthesisPairs.get(runtimeZeroRange.start + 5) === runtimeZeroRange.end - 1;
      if (everyUnresolvedChildIsZeroed || fallbackIsRoundFunction)
        runtimeZeroFallback = resolveFrameExpression(frame, value, range, budget, '0');
    }
  }
  if (runtimeZeroFallback === fallbackResolutionTooComplex)
    return [
      {
        ...candidate,
        resolvedFallback: fallbackResolutionTooComplex,
        resolvedClassification: 'too-complex',
      },
    ];
  const runtimeZeroClassification = analyzeFrameExpression(
    frame,
    runtimeZeroFallback,
    budget,
  ).classification;
  const boundedProgressCandidates = progressAnalysis.candidates;
  const uneliminatedCandidates = (
    runtimeZeroClassification === 'negative' || runtimeZeroClassification === 'magic'
      ? [
          ...childCandidates,
          ...directArgumentCandidates,
          ...boundedProgressCandidates,
          {
            ...candidate,
            resolvedFallback: runtimeZeroFallback,
            resolvedClassification: runtimeZeroClassification,
          },
        ]
      : [...childCandidates, ...directArgumentCandidates, ...boundedProgressCandidates]
  ).filter((childCandidate) => !candidateConflictsWithStaticMathArgument(childCandidate));

  const hasNonnegativeFloor =
    hasFallbackIndependentSafeBound(frame, value, range, 'max', 'negative', parenthesisPairs) ||
    hasFallbackIndependentClampBound(frame, value, range, 0, 'negative', budget, parenthesisPairs);
  const hasMagicBound =
    hasFallbackIndependentSafeBound(frame, value, range, 'max', 'magic', parenthesisPairs) ||
    hasFallbackIndependentSafeBound(frame, value, range, 'min', 'magic', parenthesisPairs) ||
    hasFallbackIndependentClampBound(frame, value, range, 2, 'magic', budget, parenthesisPairs);
  const contextuallyUnprovenCandidates = uneliminatedCandidates.filter((childCandidate) => {
    const classification = childCandidate.resolvedClassification;
    return !(
      (hasNonnegativeFloor && classification === 'negative') ||
      (hasMagicBound && classification === 'magic')
    );
  });
  if (
    (frame.resolvedClassification === 'negative' || frame.resolvedClassification === 'magic') &&
    !contextuallyUnprovenCandidates.some(
      (childCandidate) => childCandidate.resolvedClassification === frame.resolvedClassification,
    )
  ) {
    const matchingCandidate = uneliminatedCandidates.find(
      (childCandidate) => childCandidate.resolvedClassification === frame.resolvedClassification,
    );
    contextuallyUnprovenCandidates.push(matchingCandidate ?? candidate);
  }
  const distinctCandidates = uniqueCandidatesByClassification(contextuallyUnprovenCandidates);
  if (distinctCandidates.length === 0) return [];

  if (
    frame.type === 'root' &&
    frame.resolvedClassification === 'safe' &&
    frame.negativeZeroIsSafeFinalLayer
  )
    return [];
  // With exactly one fallback path, a concrete enclosing expression can prove
  // that path safe (for example, max(var(--layer, -1), 0)). An expression that
  // is only the child itself provides no such context.
  if (frame.resolvedClassification !== 'safe') return distinctCandidates;
  const resolvedValueCanExposeNegativeSign =
    frame.signedZeroSensitiveContext &&
    typeof frame.resolvedFallback === 'string' &&
    isStaticallyNegativeBeforeIntegerRounding(frame.resolvedFallback);
  if (
    !hasSingleChildWithEnclosingContext ||
    resolvedNegativeZero ||
    resolvedValueCanExposeNegativeSign
  )
    return distinctCandidates;
  return distinctCandidates.filter((childCandidate) => childCandidate.hasRuntimeSibling);
}

// Parse every var()/env()/attr() fallback in one pass with an explicit
// parentheses stack. Each closed function is resolved bottom-up by substituting
// direct nested fallback paths; the root frame propagates them into enclosing
// declaration arithmetic without recursion.
function fallbackCandidates(value) {
  const candidates = [];
  const parentheses = [];
  const parenthesisPairs = new Map();
  const fallbackFrames = [];
  const rootFrame = { type: 'root', children: [], hasInvalidCommaStream: false };
  const resolutionBudget = { remaining: fallbackResolutionWorkLimit };

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
    fallbackFunctionPattern.lastIndex = index;
    const functionMatch = fallbackFunctionPattern.exec(value);
    const previousCharacter = value[index - 1];
    if (
      functionMatch &&
      !isCssIdentifierCharacter(previousCharacter) &&
      previousCharacter !== '#' &&
      previousCharacter !== '@'
    ) {
      const nearestFunction = fallbackFrames.at(-1);
      const inheritedContext = parentheses.at(-1)?.signedZeroSensitiveContext === true;
      const inheritedConsumerContext = parentheses.at(-1)?.consumerRequiresSignedZero === true;
      const frame = {
        type: 'fallback',
        functionName: functionMatch[0].slice(0, -1).toLowerCase(),
        start: index,
        openIndex: index + functionMatch[0].length - 1,
        commaIndex: -1,
        children: [],
        consumerRequiresSignedZero: inheritedConsumerContext,
        unprovenBannedCandidates: [],
        resolvedFallback: null,
        resolvedClassification: 'unresolved',
        mathContext: parentheses.at(-1)?.mathContext === true,
        invalidFunctionParent: parentheses.at(-1)?.invalidFunctionParent,
        parenthesisParent: parentheses.at(-1),
        progressParent: parentheses.at(-1)?.progressParent,
        unsupportedProgressRangeParent: parentheses.at(-1)?.unsupportedProgressRangeParent,
        signedZeroSensitiveContext: inheritedContext || isPrecededByDivision(value, index),
      };
      if (nearestFunction && nearestFunction.commaIndex !== -1)
        nearestFunction.children.push(frame);
      else if (!nearestFunction) rootFrame.children.push(frame);
      parentheses.push(frame);
      fallbackFrames.push(frame);
      index = frame.openIndex;
      continue;
    }

    if (value[index] === '(') {
      const parenthesisParent = parentheses.at(-1);
      const context = contextForOpeningParenthesis(
        value,
        index,
        parenthesisParent?.signedZeroSensitiveContext === true,
        parenthesisParent?.mathContext === true,
        parenthesisParent?.consumerRequiresSignedZero === true,
      );
      const group = {
        type: 'group',
        openIndex: index,
        ...context,
      };
      const isInvalidFunctionBlock =
        !group.isGroupingParenthesis &&
        !mathFunctionNames.has(group.functionName) &&
        !substitutionFunctionNames.has(group.functionName);
      group.invalidFunctionParent = isInvalidFunctionBlock
        ? group
        : mathFunctionNames.has(group.functionName)
          ? undefined
          : parenthesisParent?.invalidFunctionParent;
      group.progressParent =
        group.functionName === 'progress' ? group : parenthesisParent?.progressParent;
      const progressRangeIsUnsupported =
        group.signedZeroSensitiveContext ||
        (!group.isGroupingParenthesis &&
          group.functionName !== 'calc' &&
          group.functionName !== '-webkit-calc' &&
          group.functionName !== 'progress');
      group.unsupportedProgressRangeParent = progressRangeIsUnsupported
        ? group
        : parenthesisParent?.unsupportedProgressRangeParent;
      parentheses.push(group);
      continue;
    }
    if (value[index] === ',') {
      const frame = parentheses.at(-1);
      if (frame?.type === 'fallback' && frame.commaIndex === -1) frame.commaIndex = index;
      else if (frame?.type === 'group' && frame.functionName === 'rem')
        frame.signedZeroSensitiveContext = false;
      if (
        frame === undefined ||
        (frame?.type === 'group' &&
          (frame.isGroupingParenthesis ||
            frame.functionName === 'calc' ||
            frame.functionName === '-webkit-calc'))
      )
        rootFrame.hasInvalidCommaStream = true;
      continue;
    }
    if (value[index] !== ')') continue;

    const frame = parentheses.pop();
    if (frame !== undefined) {
      frame.end = index + 1;
      parenthesisPairs.set(frame.openIndex, index);
    }
    if (frame?.type !== 'fallback') continue;
    fallbackFrames.pop();
    frame.end = index + 1;
    if (frame.commaIndex === -1) continue;
    if (!validSubstitutionHeader(frame, value)) {
      frame.resolvedFallback = null;
      frame.resolvedClassification = 'unresolved';
      frame.resolvedNegativeZero = false;
      frame.negativeZeroIsSafeFinalLayer = false;
      frame.unprovenBannedCandidates = [];
      continue;
    }

    const fallbackRange = trimCssTriviaRange(value, frame.commaIndex + 1, index);
    const rawFallback = value.slice(fallbackRange.start, fallbackRange.end);
    frame.resolvedFallback = resolveFrameExpression(frame, value, fallbackRange, resolutionBudget);
    const [onlyChild] = frame.children;
    const frameAnalysis =
      frame.children.length === 1 &&
      onlyChild.start === fallbackRange.start &&
      onlyChild.end === fallbackRange.end
        ? {
            classification: onlyChild.resolvedClassification,
            resultType: onlyChild.resolvedResultType,
          }
        : analyzeFrameExpression(frame, frame.resolvedFallback, resolutionBudget);
    frame.resolvedClassification = frameAnalysis.classification;
    frame.resolvedResultType = frameAnalysis.resultType;
    frame.resolvedNegativeZero =
      frame.children.length === 1 &&
      onlyChild.start === fallbackRange.start &&
      onlyChild.end === fallbackRange.end
        ? onlyChild.resolvedNegativeZero
        : typeof frame.resolvedFallback === 'string' &&
          isStaticallyNegativeZero(frame.resolvedFallback);
    frame.negativeZeroIsSafeFinalLayer = negativeZeroIsSafeFinalLayer(
      frame,
      value,
      fallbackRange,
      resolutionBudget,
    );
    const candidate = {
      fallbackIndex: fallbackRange.start,
      rawFallback,
      resolvedFallback: frame.resolvedFallback,
      resolvedClassification: frame.resolvedClassification,
    };
    frame.unprovenBannedCandidates = unprovenCandidatesForFrame(
      frame,
      value,
      fallbackRange,
      candidate,
      resolutionBudget,
      parenthesisPairs,
    );
    if (frame.children.length > 1)
      frame.unprovenBannedCandidates = frame.unprovenBannedCandidates.map((childCandidate) => ({
        ...childCandidate,
        hasRuntimeSibling: true,
      }));
  }

  if (rootFrame.children.length > 0) {
    const resolvedValue = resolveFrameExpression(
      rootFrame,
      value,
      { start: 0, end: value.length },
      resolutionBudget,
    );
    rootFrame.resolvedFallback = resolvedValue;
    const [onlyRootChild] = rootFrame.children;
    const rootAnalysis =
      rootFrame.children.length === 1 &&
      onlyRootChild.start === 0 &&
      onlyRootChild.end === value.length
        ? {
            classification: onlyRootChild.resolvedClassification,
            resultType: onlyRootChild.resolvedResultType,
          }
        : analyzeResolvedFallback(resolvedValue);
    rootFrame.resolvedClassification = rootAnalysis.classification;
    rootFrame.resolvedResultType = rootAnalysis.resultType;
    rootFrame.resolvedNegativeZero =
      rootFrame.children.length === 1 &&
      onlyRootChild.start === 0 &&
      onlyRootChild.end === value.length
        ? onlyRootChild.resolvedNegativeZero
        : typeof resolvedValue === 'string' && isStaticallyNegativeZero(resolvedValue);
    rootFrame.negativeZeroIsSafeFinalLayer = negativeZeroIsSafeFinalLayer(
      rootFrame,
      value,
      { start: 0, end: value.length },
      resolutionBudget,
    );
    const rootCandidate = {
      fallbackIndex: 0,
      rawFallback: value,
      resolvedFallback: resolvedValue,
      resolvedClassification: rootFrame.resolvedClassification,
    };
    const unprovenRootCandidates = unprovenCandidatesForFrame(
      rootFrame,
      value,
      { start: 0, end: value.length },
      rootCandidate,
      resolutionBudget,
      parenthesisPairs,
    );
    candidates.push(...unprovenRootCandidates);
  }

  return candidates;
}

export function bannedFallback(value) {
  const normalizedValue = normalizeCssEscapesForInspection(value);
  const decodedValue = maskTokenizingComments(normalizedValue.value);
  const { sourceRanges } = normalizedValue;
  for (const { fallbackIndex, rawFallback, resolvedClassification } of fallbackCandidates(
    decodedValue,
  )) {
    const analysisWasTooComplex = resolvedClassification === 'too-complex';
    if (
      analysisWasTooComplex ||
      resolvedClassification === 'negative' ||
      resolvedClassification === 'magic'
    ) {
      const sourceRangeStart = sourceRanges[fallbackIndex];
      const sourceRangeEnd = sourceRanges[fallbackIndex + rawFallback.length - 1];
      return {
        index: sourceRangeStart?.start,
        length:
          sourceRangeStart === undefined || sourceRangeEnd === undefined
            ? undefined
            : sourceRangeEnd.end - sourceRangeStart.start,
        value:
          sourceRangeStart === undefined || sourceRangeEnd === undefined
            ? rawFallback
            : value.slice(sourceRangeStart.start, sourceRangeEnd.end),
        reason: analysisWasTooComplex ? 'too-complex' : 'banned',
      };
    }
  }
  return undefined;
}
