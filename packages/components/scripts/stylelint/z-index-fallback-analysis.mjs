import {
  analyzeStaticLayerValue,
  classifyStaticLayer,
  cssCommentMaskCharacter,
  evaluateStaticLayerNumber,
  hasStaticallyZeroCoefficient,
  haveCompatibleStaticDivisionTypes,
  haveCompatibleStaticProgressTypes,
  haveEqualStaticArithmeticValues,
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
const typedHypotParentLimit = 2_048;
const conditionalNestingLimit = 128;
const uniformDivisorWitnessValues = ['1', '2', '1px', '1deg', '1s', '1hz', '1dppx'];
const typedDivisorWitnessValues = ['1px', '1deg', '1s', '1hz', '1dppx'];
const typedZeroWitnessValues = ['0px', '0deg', '0s', '0hz', '0dppx'];
const hypotRuntimeWitnessValues = ['1', ...typedDivisorWitnessValues];
const extremaFunctionNames = new Set(['clamp', 'max', 'min']);
const hypotFunctionNames = new Set(['hypot']);
const conditionalFunctionNames = new Set(['first-valid', 'if']);
const contextualProgressFunctionNames = new Set(['container-progress', 'media-progress']);
const progressFunctionNames = new Set(['progress', ...contextualProgressFunctionNames]);
const mediaProgressFeatureWitnesses = new Map([
  ['aspect-ratio', '1'],
  ['color', '1'],
  ['color-index', '1'],
  ['device-aspect-ratio', '1'],
  ['device-height', '1px'],
  ['device-width', '1px'],
  ['height', '1px'],
  ['horizontal-viewport-segments', '1'],
  ['monochrome', '1'],
  ['resolution', '1dppx'],
  ['vertical-viewport-segments', '1'],
  ['width', '1px'],
]);
const integerMediaProgressFeatureNames = new Set([
  'color',
  'color-index',
  'horizontal-viewport-segments',
  'monochrome',
  'vertical-viewport-segments',
]);
const containerProgressFeatureWitnesses = new Map([
  ['aspect-ratio', '1'],
  ['block-size', '1px'],
  ['height', '1px'],
  ['inline-size', '1px'],
  ['width', '1px'],
]);
const unresolvedRuntimeFunctionArities = new Map([
  ['abs', 1],
  ['acos', 1],
  ['asin', 1],
  ['atan', 1],
  ['atan2', 2],
  ['cos', 1],
  ['exp', 1],
  ['log', [1, 2]],
  ['mod', 2],
  ['pow', 2],
  ['random', [2, 3, 4]],
  ['rem', 2],
  ['round', [1, 2, 3]],
  ['sin', 1],
  ['sqrt', 1],
  ['tan', 1],
]);
const invalidCustomIdentKeywords = new Set([
  'default',
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'unset',
]);
const validZIndexWholeValueKeywords = new Set([
  'auto',
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
const signedZeroSensitiveFunctionNames = new Set([
  'asin',
  'atan',
  'atan2',
  'log',
  'pow',
  'sign',
  'sin',
  'sqrt',
  'tan',
]);
const substitutionFunctionNames = new Set(['attr', 'env', 'var']);
const treeCountingFunctionNames = new Set(['sibling-count', 'sibling-index']);
const steppedValueFunctionNames = new Set(['mod', 'rem', 'round']);
const roundingStrategyNames = new Set(['down', 'line-width', 'nearest', 'to-zero', 'up']);
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
  'random',
  'rem',
  'round',
  'sign',
  'sin',
  'sqrt',
  ...treeCountingFunctionNames,
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
    // surrounding value. Comment-mask separators preserve token boundaries
    // for analysis without inventing whitespace around additive operators.
    const replacementValue = replaceEveryChild
      ? unresolvedReplacement
      : (child.resolvedFallback ?? unresolvedReplacement);
    const replacement = `${cssCommentMaskCharacter}${replacementValue}${cssCommentMaskCharacter}`;
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

function resolveFrameExpressionWithRangeReplacements(
  frame,
  value,
  range,
  budget,
  explicitReplacements,
) {
  if (!consumeResolutionWork(budget, explicitReplacements.length))
    return fallbackResolutionTooComplex;
  const orderedExplicitReplacements = [...explicitReplacements].sort(
    (left, right) => left.start - right.start,
  );
  const replacements = [...orderedExplicitReplacements];
  let explicitReplacementIndex = 0;
  for (const child of frame.children) {
    if (child.start < range.start || child.end > range.end) continue;
    while (
      orderedExplicitReplacements[explicitReplacementIndex]?.end !== undefined &&
      orderedExplicitReplacements[explicitReplacementIndex].end <= child.start
    )
      explicitReplacementIndex += 1;
    const explicitReplacement = orderedExplicitReplacements[explicitReplacementIndex];
    if (explicitReplacement?.start <= child.start && explicitReplacement.end >= child.end) continue;
    if (child.resolvedFallback === fallbackResolutionTooComplex)
      return fallbackResolutionTooComplex;
    replacements.push({
      end: child.end,
      start: child.start,
      value: child.resolvedFallback ?? '0',
    });
  }

  const rawExpressionLength = range.end - range.start;
  if (!consumeResolutionWork(budget, rawExpressionLength)) return fallbackResolutionTooComplex;
  let resolvedExpression = value.slice(range.start, range.end);
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    const relativeStart = replacement.start - range.start;
    const relativeEnd = replacement.end - range.start;
    const replacementValue = `${cssCommentMaskCharacter}${replacement.value}${cssCommentMaskCharacter}`;
    const nextLength =
      resolvedExpression.length - (relativeEnd - relativeStart) + replacementValue.length;
    if (!consumeResolutionWork(budget, nextLength)) return fallbackResolutionTooComplex;
    resolvedExpression =
      resolvedExpression.slice(0, relativeStart) +
      replacementValue +
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
    isGroupingParenthesis ||
    substitutionFunctionNames.has(functionName) ||
    functionName === 'random-item' ||
    contextualProgressFunctionNames.has(functionName);
  return {
    consumerRequiresSignedZero:
      inheritedConsumerContext || signedZeroSensitiveFunctionNames.has(functionName),
    functionStart,
    functionName,
    isGroupingParenthesis,
    mathContext:
      mathFunctionNames.has(functionName) ||
      contextualProgressFunctionNames.has(functionName) ||
      (inheritsParentGrammar && inheritedMathContext),
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

  let groupingParent = child.parenthesisParent;
  let containerStart;
  let containerEnd;
  let divisionIndex;
  while (
    groupingParent?.type === 'group' &&
    groupingParent.end !== undefined &&
    (groupingParent.isGroupingParenthesis || mathFunctionNames.has(groupingParent.functionName))
  ) {
    containerStart = groupingParent.isGroupingParenthesis
      ? groupingParent.openIndex
      : groupingParent.functionStart;
    containerEnd = groupingParent.end;
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
    divisionIndex = containerStart;
    while (divisionIndex > range.start && isCssWhitespaceOrComment(value[divisionIndex - 1]))
      divisionIndex -= 1;
    if (value[divisionIndex - 1] === '/') break;
    groupingParent = groupingParent.parenthesisParent;
  }
  if (
    containerStart === undefined ||
    containerEnd === undefined ||
    divisionIndex === undefined ||
    value[divisionIndex - 1] !== '/'
  )
    return directRange;
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
    uniformDivisorWitnessValues.length +
    typedDivisorWitnessValues.length * containedChildren.length;
  for (
    let witnessAssignmentIndex = 0;
    witnessAssignmentIndex < witnessAssignmentCount;
    witnessAssignmentIndex += 1
  ) {
    const possibleDivisorParts = [];
    let sourceIndex = factorRange.start;
    for (let childIndex = 0; childIndex < containedChildren.length; childIndex += 1) {
      const candidate = containedChildren[childIndex];
      const typedAssignmentIndex = witnessAssignmentIndex - uniformDivisorWitnessValues.length;
      const witnessValueIndex = Math.floor(typedAssignmentIndex / containedChildren.length);
      const typedChildIndex = typedAssignmentIndex % containedChildren.length;
      const witness =
        witnessAssignmentIndex < uniformDivisorWitnessValues.length
          ? uniformDivisorWitnessValues[witnessAssignmentIndex]
          : childIndex === typedChildIndex
            ? typedDivisorWitnessValues[witnessValueIndex]
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
        if (
          analyzeStaticLayerValue(quotientWitness).resultType === 'number' ||
          haveCompatibleStaticDivisionTypes(numerator, witness)
        ) {
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

function topLevelAdditiveTermRanges(value, range, parenthesisPairs) {
  const expressionRange = unwrapStaticContainer(value, range, parenthesisPairs);
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
  return termRanges;
}

function additiveNonNumberCandidateSuppression(frame, value, range, budget, parenthesisPairs) {
  const expressionRange = unwrapStaticContainer(value, range, parenthesisPairs);
  if (!consumeResolutionWork(budget, expressionRange.end - expressionRange.start)) return undefined;
  const termRanges = topLevelAdditiveTermRanges(value, range, parenthesisPairs);
  if (termRanges === undefined) return undefined;

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

function firstChildEndingAfter(children, rangeStart) {
  let lowerIndex = 0;
  let upperIndex = children.length;
  while (lowerIndex < upperIndex) {
    const middleIndex = lowerIndex + Math.floor((upperIndex - lowerIndex) / 2);
    if (children[middleIndex].end <= rangeStart) lowerIndex = middleIndex + 1;
    else upperIndex = middleIndex;
  }
  return lowerIndex;
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

  let childIndex = firstChildEndingAfter(frame.children, argumentRanges[0].start);
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

function isValidConditionalBooleanExpression(value, range, parenthesisPairs, depth = 0) {
  if (depth > conditionalNestingLimit) return fallbackResolutionTooComplex;
  const expressionRange = trimCssTriviaRange(value, range.start, range.end);
  if (expressionRange.start === expressionRange.end) return false;

  const skipTrivia = (start) => {
    while (start < expressionRange.end && isCssWhitespaceOrComment(value[start])) start += 1;
    return start;
  };
  const consumeGroup = (start) => {
    start = skipTrivia(start);
    if (value[start] === '(') {
      const closeIndex = parenthesisPairs.get(start);
      if (closeIndex === undefined || closeIndex >= expressionRange.end) return undefined;
      const nestedResult = isValidConditionalBooleanExpression(
        value,
        { start: start + 1, end: closeIndex },
        parenthesisPairs,
        depth + 1,
      );
      if (nestedResult === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
      if (!nestedResult) return undefined;
      return closeIndex + 1;
    }
    const identifierEnd = cssIdentifierTokenEnd(value, start);
    if (identifierEnd === start || value[identifierEnd] !== '(') return undefined;
    const closeIndex = parenthesisPairs.get(identifierEnd);
    if (closeIndex === undefined || closeIndex >= expressionRange.end) return undefined;
    const functionName = value.slice(start, identifierEnd).toLowerCase();
    const functionContents = trimCssTriviaRange(value, identifierEnd + 1, closeIndex);
    if (!['media', 'style', 'supports'].includes(functionName)) return undefined;
    const testResult = conditionalTestContentsAreStructurallyValid(
      value,
      functionContents,
      parenthesisPairs,
      functionName,
    );
    if (testResult === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
    if (!testResult) return undefined;
    return closeIndex + 1;
  };

  let cursor = expressionRange.start;
  const firstIdentifierEnd = cssIdentifierTokenEnd(value, cursor);
  const firstIdentifier = value.slice(cursor, firstIdentifierEnd).toLowerCase();
  const hasLeadingNot = firstIdentifier === 'not' && value[firstIdentifierEnd] !== '(';
  if (hasLeadingNot) cursor = skipTrivia(firstIdentifierEnd);
  cursor = consumeGroup(cursor);
  if (cursor === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
  if (cursor === undefined) return false;
  cursor = skipTrivia(cursor);
  if (hasLeadingNot) return cursor === expressionRange.end;

  let operator;
  while (cursor < expressionRange.end) {
    const operatorEnd = cssIdentifierTokenEnd(value, cursor);
    const nextOperator = value.slice(cursor, operatorEnd).toLowerCase();
    if (nextOperator !== 'and' && nextOperator !== 'or') return false;
    if (operator !== undefined && operator !== nextOperator) return false;
    operator = nextOperator;
    cursor = consumeGroup(skipTrivia(operatorEnd));
    if (cursor === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
    if (cursor === undefined) return false;
    cursor = skipTrivia(cursor);
  }
  return true;
}

function mediaQueryStaticTruth(value, range) {
  const expressionRange = trimCssTriviaRange(value, range.start, range.end);
  const skipTrivia = (start) => {
    while (start < expressionRange.end && isCssWhitespaceOrComment(value[start])) start += 1;
    return start;
  };
  let cursor = expressionRange.start;
  let identifierEnd = cssIdentifierTokenEnd(value, cursor);
  const modifier = normalizeCssEscapesForInspection(
    value.slice(cursor, identifierEnd),
  ).value.toLowerCase();
  if (modifier === 'not' || modifier === 'only') {
    cursor = skipTrivia(identifierEnd);
    if (value[cursor] === '(') return undefined;
    identifierEnd = cssIdentifierTokenEnd(value, cursor);
  }
  if (identifierEnd === cursor) return undefined;
  const mediaType = normalizeCssEscapesForInspection(
    value.slice(cursor, identifierEnd),
  ).value.toLowerCase();
  cursor = skipTrivia(identifierEnd);
  const hasCondition = cursor < expressionRange.end;
  if (cursor < expressionRange.end) {
    const operatorEnd = cssIdentifierTokenEnd(value, cursor);
    if (value.slice(cursor, operatorEnd).toLowerCase() !== 'and') return undefined;
  }
  if (mediaType === 'all' && !hasCondition) return modifier !== 'not';
  if (['all', 'print', 'screen'].includes(mediaType)) return undefined;
  return modifier === 'not';
}

function canonicalConditionalTestIdentity(value, start, end) {
  const output = [];
  let hasPendingWhitespace = false;
  const punctuation = '()[]{}:,;*/<>=';
  for (let index = start; index < end; index += 1) {
    const character = value[index];
    if (character === cssCommentMaskCharacter || isCssWhitespace(character)) {
      hasPendingWhitespace = true;
      continue;
    }
    if (hasPendingWhitespace) {
      const previousChunk = output.at(-1);
      const previousCharacter = previousChunk?.at(-1);
      if (
        previousCharacter !== undefined &&
        !punctuation.includes(previousCharacter) &&
        !punctuation.includes(character)
      )
        output.push(' ');
    }
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
      const lowerIdentifier = identifier.toLowerCase();
      output.push(
        value[identifierEnd] === '(' && ['media', 'style', 'supports'].includes(lowerIdentifier)
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

function conditionalBooleanStaticAnalysis(value, range, parenthesisPairs, depth = 0) {
  if (depth > conditionalNestingLimit) return { truth: undefined };
  const expressionRange = trimCssTriviaRange(value, range.start, range.end);
  const skipTrivia = (start) => {
    while (start < expressionRange.end && isCssWhitespaceOrComment(value[start])) start += 1;
    return start;
  };
  const consumeGroup = (start) => {
    start = skipTrivia(start);
    if (value[start] === '(') {
      const closeIndex = parenthesisPairs.get(start);
      if (closeIndex === undefined || closeIndex >= expressionRange.end) return undefined;
      return {
        end: closeIndex + 1,
        analysis: conditionalBooleanStaticAnalysis(
          value,
          { start: start + 1, end: closeIndex },
          parenthesisPairs,
          depth + 1,
        ),
      };
    }
    const identifierEnd = cssIdentifierTokenEnd(value, start);
    if (identifierEnd === start || value[identifierEnd] !== '(') return undefined;
    const closeIndex = parenthesisPairs.get(identifierEnd);
    if (closeIndex === undefined || closeIndex >= expressionRange.end) return undefined;
    const functionName = value.slice(start, identifierEnd).toLowerCase();
    return {
      end: closeIndex + 1,
      analysis: {
        identity: {
          key: canonicalConditionalTestIdentity(value, start, closeIndex + 1),
          negated: false,
        },
        truth:
          functionName === 'media'
            ? mediaQueryStaticTruth(value, { start: identifierEnd + 1, end: closeIndex })
            : undefined,
      },
    };
  };

  let cursor = expressionRange.start;
  const firstIdentifierEnd = cssIdentifierTokenEnd(value, cursor);
  const firstIdentifier = value.slice(cursor, firstIdentifierEnd).toLowerCase();
  const hasLeadingNot = firstIdentifier === 'not' && value[firstIdentifierEnd] !== '(';
  if (hasLeadingNot) cursor = skipTrivia(firstIdentifierEnd);
  const firstGroup = consumeGroup(cursor);
  if (firstGroup === undefined) return { truth: undefined };
  cursor = skipTrivia(firstGroup.end);
  if (hasLeadingNot) {
    if (cursor !== expressionRange.end) return { truth: undefined };
    return {
      ...(firstGroup.analysis.identity === undefined
        ? {}
        : {
            identity: {
              key: firstGroup.analysis.identity.key,
              negated: !firstGroup.analysis.identity.negated,
            },
          }),
      truth: firstGroup.analysis.truth === undefined ? undefined : !firstGroup.analysis.truth,
    };
  }

  const analyses = [firstGroup.analysis];
  let operator;
  while (cursor < expressionRange.end) {
    const operatorEnd = cssIdentifierTokenEnd(value, cursor);
    const nextOperator = value.slice(cursor, operatorEnd).toLowerCase();
    if (nextOperator !== 'and' && nextOperator !== 'or') return { truth: undefined };
    operator ??= nextOperator;
    if (operator !== nextOperator) return { truth: undefined };
    const nextGroup = consumeGroup(skipTrivia(operatorEnd));
    if (nextGroup === undefined) return { truth: undefined };
    analyses.push(nextGroup.analysis);
    cursor = skipTrivia(nextGroup.end);
  }
  if (operator === undefined) return firstGroup.analysis;

  const identitiesByKey = new Map();
  for (const analysis of analyses) {
    if (analysis.identity === undefined) continue;
    const polarities = identitiesByKey.get(analysis.identity.key) ?? new Set();
    polarities.add(analysis.identity.negated);
    identitiesByKey.set(analysis.identity.key, polarities);
  }
  const hasComplementaryPair = [...identitiesByKey.values()].some(
    (polarities) => polarities.size === 2,
  );
  const truths = analyses.map((analysis) => analysis.truth);
  if (operator === 'and') {
    if (truths.includes(false) || hasComplementaryPair) return { truth: false };
    return { truth: truths.every((truth) => truth === true) ? true : undefined };
  }
  if (truths.includes(true) || hasComplementaryPair) return { truth: true };
  return { truth: truths.every((truth) => truth === false) ? false : undefined };
}

function conditionalBooleanStaticTruth(value, range, parenthesisPairs) {
  return conditionalBooleanStaticAnalysis(value, range, parenthesisPairs).truth;
}

function conditionalTestContentsAreStructurallyValid(value, range, parenthesisPairs, functionName) {
  if (functionName === 'media')
    return mediaQueryIsStructurallyValid(value, range, parenthesisPairs);
  if (range.start === range.end) return false;
  const firstIdentifierEnd = cssIdentifierTokenEnd(value, range.start);
  if (value[range.start] !== '(' && firstIdentifierEnd === range.start) return false;
  const lastCharacter = value[range.end - 1];
  if (':,;<>='.includes(lastCharacter)) return false;

  for (let index = range.start; index < range.end; index += 1) {
    if (value[index] === '"' || value[index] === "'") index = quotedStringEnd(value, index);
    else {
      const urlTokenEnd = unquotedUrlTokenEnd(value, index);
      if (urlTokenEnd !== undefined) index = urlTokenEnd;
      else if (value[index] === '(') {
        const closeIndex = parenthesisPairs.get(index);
        if (closeIndex === undefined || closeIndex >= range.end) return false;
        index = closeIndex;
      } else if (value[index] === ',') return false;
      else if (value[index] === ':') {
        const left = trimCssTriviaRange(value, range.start, index);
        const right = trimCssTriviaRange(value, index + 1, range.end);
        if (left.start === left.end || right.start === right.end) return false;
      }
    }
  }
  return true;
}

function mediaQueryIsStructurallyValid(value, range, parenthesisPairs) {
  const expressionRange = trimCssTriviaRange(value, range.start, range.end);
  const standaloneIdentifierEnd = cssIdentifierTokenEnd(value, expressionRange.start);
  if (
    standaloneIdentifierEnd === expressionRange.end &&
    ['and', 'layer', 'not', 'only', 'or'].includes(
      value.slice(expressionRange.start, standaloneIdentifierEnd).toLowerCase(),
    )
  )
    return false;
  if (mediaFeatureIsStructurallyValid(value, range, parenthesisPairs)) return true;
  const conditionResult = mediaConditionIsStructurallyValid(value, range, parenthesisPairs);
  if (conditionResult !== false) return conditionResult;

  const skipTrivia = (start) => {
    while (start < expressionRange.end && isCssWhitespaceOrComment(value[start])) start += 1;
    return start;
  };
  let cursor = expressionRange.start;
  let identifierEnd = cssIdentifierTokenEnd(value, cursor);
  const firstIdentifier = value.slice(cursor, identifierEnd).toLowerCase();
  if (firstIdentifier === 'not' || firstIdentifier === 'only') {
    cursor = skipTrivia(identifierEnd);
    identifierEnd = cssIdentifierTokenEnd(value, cursor);
  }
  if (identifierEnd === cursor) return false;
  const mediaType = value.slice(cursor, identifierEnd).toLowerCase();
  if (['and', 'layer', 'not', 'only', 'or'].includes(mediaType)) return false;
  cursor = skipTrivia(identifierEnd);
  if (cursor === expressionRange.end) return true;

  const operatorEnd = cssIdentifierTokenEnd(value, cursor);
  if (value.slice(cursor, operatorEnd).toLowerCase() !== 'and') return false;
  const conditionStart = skipTrivia(operatorEnd);
  if (conditionStart === expressionRange.end) return false;
  return mediaConditionIsStructurallyValid(
    value,
    { start: conditionStart, end: expressionRange.end },
    parenthesisPairs,
    0,
    false,
  );
}

function mediaConditionIsStructurallyValid(
  value,
  range,
  parenthesisPairs,
  depth = 0,
  allowOr = true,
) {
  if (depth > conditionalNestingLimit) return fallbackResolutionTooComplex;
  const expressionRange = trimCssTriviaRange(value, range.start, range.end);
  if (expressionRange.start === expressionRange.end) return false;

  const skipTrivia = (start) => {
    while (start < expressionRange.end && isCssWhitespaceOrComment(value[start])) start += 1;
    return start;
  };
  const consumeGroup = (start) => {
    start = skipTrivia(start);
    if (value[start] !== '(') return undefined;
    const closeIndex = parenthesisPairs.get(start);
    if (closeIndex === undefined || closeIndex >= expressionRange.end) return undefined;
    const contents = trimCssTriviaRange(value, start + 1, closeIndex);
    const nestedCondition = mediaConditionIsStructurallyValid(
      value,
      contents,
      parenthesisPairs,
      depth + 1,
    );
    if (nestedCondition === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
    if (!mediaFeatureIsStructurallyValid(value, contents, parenthesisPairs) && !nestedCondition)
      return undefined;
    return closeIndex + 1;
  };

  let cursor = expressionRange.start;
  const firstIdentifierEnd = cssIdentifierTokenEnd(value, cursor);
  const hasLeadingNot =
    value.slice(cursor, firstIdentifierEnd).toLowerCase() === 'not' &&
    value[firstIdentifierEnd] !== '(';
  if (hasLeadingNot) cursor = skipTrivia(firstIdentifierEnd);
  cursor = consumeGroup(cursor);
  if (cursor === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
  if (cursor === undefined) return false;
  cursor = skipTrivia(cursor);
  if (hasLeadingNot) return cursor === expressionRange.end;

  let operator;
  while (cursor < expressionRange.end) {
    const operatorEnd = cssIdentifierTokenEnd(value, cursor);
    const nextOperator = value.slice(cursor, operatorEnd).toLowerCase();
    if (nextOperator !== 'and' && nextOperator !== 'or') return false;
    if (nextOperator === 'or' && !allowOr) return false;
    if (operator !== undefined && operator !== nextOperator) return false;
    operator = nextOperator;
    cursor = consumeGroup(skipTrivia(operatorEnd));
    if (cursor === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
    if (cursor === undefined) return false;
    cursor = skipTrivia(cursor);
  }
  return true;
}

function mediaFeatureIsStructurallyValid(value, range, parenthesisPairs) {
  const featureRange = trimCssTriviaRange(value, range.start, range.end);
  if (featureRange.start === featureRange.end) return false;
  const comparisons = [];
  let colonIndex = -1;
  for (let index = featureRange.start; index < featureRange.end; index += 1) {
    if (value[index] === '"' || value[index] === "'") return false;
    const urlTokenEnd = unquotedUrlTokenEnd(value, index);
    if (urlTokenEnd !== undefined) return false;
    if (value[index] === '(') {
      const identifierStart = cssIdentifierStart(value, index);
      if (identifierStart === index) return false;
      const closeIndex = parenthesisPairs.get(index);
      if (closeIndex === undefined || closeIndex >= featureRange.end) return false;
      index = closeIndex;
    } else if (value[index] === ',' || value[index] === ';') return false;
    else if (value[index] === ':') {
      if (colonIndex !== -1) return false;
      colonIndex = index;
    } else if ('<>='.includes(value[index])) {
      const operatorEnd = value[index + 1] === '=' ? index + 2 : index + 1;
      comparisons.push({ end: operatorEnd, start: index });
      index = operatorEnd - 1;
    }
  }

  if (colonIndex !== -1) {
    if (comparisons.length > 0) return false;
    return (
      rangeIsSingleCssIdentifier(value, featureRange.start, colonIndex) &&
      mediaFeatureValueIsStructurallyValid(
        value,
        { start: colonIndex + 1, end: featureRange.end },
        parenthesisPairs,
      )
    );
  }
  if (comparisons.length === 0)
    return rangeIsSingleCssIdentifier(value, featureRange.start, featureRange.end);
  if (comparisons.length === 1) {
    const [comparison] = comparisons;
    const leftIsName = rangeIsSingleCssIdentifier(value, featureRange.start, comparison.start);
    const rightIsName = rangeIsSingleCssIdentifier(value, comparison.end, featureRange.end);
    return (
      (leftIsName &&
        mediaFeatureValueIsStructurallyValid(
          value,
          { start: comparison.end, end: featureRange.end },
          parenthesisPairs,
        )) ||
      (rightIsName &&
        mediaFeatureValueIsStructurallyValid(
          value,
          { start: featureRange.start, end: comparison.start },
          parenthesisPairs,
        ))
    );
  }
  if (comparisons.length !== 2) return false;
  const [firstComparison, secondComparison] = comparisons;
  if (
    !rangeIsSingleCssIdentifier(value, firstComparison.end, secondComparison.start) ||
    !mediaFeatureValueIsStructurallyValid(
      value,
      { start: featureRange.start, end: firstComparison.start },
      parenthesisPairs,
    ) ||
    !mediaFeatureValueIsStructurallyValid(
      value,
      { start: secondComparison.end, end: featureRange.end },
      parenthesisPairs,
    )
  )
    return false;
  const firstDirection = value[firstComparison.start];
  return firstDirection !== '=' && firstDirection === value[secondComparison.start];
}

function cssIdentifierStart(value, openIndex) {
  let start = openIndex;
  while (start > 0 && isCssIdentifierCharacter(value[start - 1])) start -= 1;
  return start;
}

function rangeIsSingleCssIdentifier(value, start, end) {
  const range = trimCssTriviaRange(value, start, end);
  return range.start < range.end && cssIdentifierTokenEnd(value, range.start) === range.end;
}

function cssNumericToken(value, start) {
  let end = start;
  if (value[end] === '+' || value[end] === '-') end += 1;
  let sawDigit = false;
  while (/\d/.test(value[end] ?? '')) {
    sawDigit = true;
    end += 1;
  }
  if (value[end] === '.' && /\d/.test(value[end + 1] ?? '')) {
    end += 1;
    while (/\d/.test(value[end] ?? '')) {
      sawDigit = true;
      end += 1;
    }
  }
  if (!sawDigit) return undefined;
  if (/e/i.test(value[end] ?? '') && /[+\-\d]/.test(value[end + 1] ?? '')) {
    end += 1;
    if (value[end] === '+' || value[end] === '-') end += 1;
    const exponentStart = end;
    while (/\d/.test(value[end] ?? '')) end += 1;
    if (end === exponentStart) return undefined;
  }
  const numberEnd = end;
  if (value[end] === '%') end += 1;
  else end = cssIdentifierTokenEnd(value, end);
  return { end, hasUnit: end !== numberEnd };
}

function mediaFeatureValueIsStructurallyValid(value, range, parenthesisPairs) {
  const valueRange = trimCssTriviaRange(value, range.start, range.end);
  if (valueRange.start === valueRange.end) return false;
  const identifierEnd = cssIdentifierTokenEnd(value, valueRange.start);
  if (identifierEnd > valueRange.start) {
    if (identifierEnd === valueRange.end) return true;
    if (value[identifierEnd] !== '(') return false;
    const closeIndex = parenthesisPairs.get(identifierEnd);
    if (closeIndex !== valueRange.end - 1) return false;
    const contents = trimCssTriviaRange(value, identifierEnd + 1, closeIndex);
    return (
      contents.start < contents.end &&
      mediaFeatureFunctionContentsAreStructurallyValid(
        value,
        value.slice(valueRange.start, identifierEnd).toLowerCase(),
        identifierEnd,
        closeIndex,
        parenthesisPairs,
      )
    );
  }
  const firstNumber = cssNumericToken(value, valueRange.start);
  if (firstNumber === undefined) return false;
  let cursor = firstNumber.end;
  while (cursor < valueRange.end && isCssWhitespaceOrComment(value[cursor])) cursor += 1;
  if (cursor === valueRange.end) return true;
  if (firstNumber.hasUnit || value[cursor] !== '/') return false;
  cursor += 1;
  while (cursor < valueRange.end && isCssWhitespaceOrComment(value[cursor])) cursor += 1;
  const secondNumber = cssNumericToken(value, cursor);
  if (secondNumber === undefined || secondNumber.hasUnit) return false;
  cursor = secondNumber.end;
  while (cursor < valueRange.end && isCssWhitespaceOrComment(value[cursor])) cursor += 1;
  return cursor === valueRange.end;
}

function mediaFeatureFunctionContentsAreStructurallyValid(
  value,
  functionName,
  openIndex,
  closeIndex,
  parenthesisPairs,
  depth = 0,
) {
  if (depth > conditionalNestingLimit) return true;
  let argumentStart = openIndex + 1;
  let firstCommaIndex = closeIndex;
  for (let index = argumentStart; index < closeIndex; index += 1) {
    if (value[index] === '"' || value[index] === "'") index = quotedStringEnd(value, index);
    else if (value[index] === '(') {
      const nestedCloseIndex = parenthesisPairs.get(index);
      if (nestedCloseIndex === undefined || nestedCloseIndex >= closeIndex) return false;
      const nestedFunctionStart = cssIdentifierStart(value, index);
      if (nestedFunctionStart < index) {
        const nestedContents = trimCssTriviaRange(value, index + 1, nestedCloseIndex);
        if (
          nestedContents.start === nestedContents.end ||
          !mediaFeatureFunctionContentsAreStructurallyValid(
            value,
            value.slice(nestedFunctionStart, index).toLowerCase(),
            index,
            nestedCloseIndex,
            parenthesisPairs,
            depth + 1,
          )
        )
          return false;
      }
      index = nestedCloseIndex;
    } else if (value[index] === ',') {
      if (firstCommaIndex === closeIndex) firstCommaIndex = index;
      if (!substitutionFunctionNames.has(functionName)) {
        const argument = trimCssTriviaRange(value, argumentStart, index);
        if (argument.start === argument.end) return false;
        argumentStart = index + 1;
      }
    }
  }
  if (substitutionFunctionNames.has(functionName))
    return validSubstitutionHeader({ commaIndex: firstCommaIndex, functionName, openIndex }, value);
  const finalArgument = trimCssTriviaRange(value, argumentStart, closeIndex);
  return finalArgument.start < finalArgument.end;
}

function firstValidRuntimeFunctionStaticValidity(
  value,
  frame,
  branchRange,
  functionName,
  parenthesisPairs,
) {
  const hasFallbackChild = frame.children.some(
    (child) => child.start >= branchRange.start && child.end <= branchRange.end,
  );
  if (progressFunctionNames.has(functionName)) {
    const group = frame.progressGroups.find(
      (candidate) =>
        candidate.functionStart === branchRange.start && candidate.end === branchRange.end,
    );
    const progressRange =
      group === undefined ? branchRange : { ...branchRange, parenthesis: group };
    if (progressRangeMode(frame, value, progressRange, parenthesisPairs) !== 'invalid') return true;
    return hasFallbackChild ? undefined : false;
  }
  if (treeCountingFunctionNames.has(functionName)) {
    const group = frame.treeCountingGroups.find(
      (candidate) =>
        candidate.functionStart === branchRange.start && candidate.end === branchRange.end,
    );
    if (group === undefined) return false;
    const contents = trimCssTriviaRange(value, group.openIndex + 1, group.end - 1);
    return contents.start === contents.end;
  }
  if (functionName === 'random-item') {
    const group = frame.randomGroups.find(
      (candidate) =>
        candidate.functionStart === branchRange.start && candidate.end === branchRange.end,
    );
    return (
      group !== undefined &&
      randomItemGroupOutputOptions(value, group, parenthesisPairs) !== undefined
    );
  }
  if (functionName !== 'random') return undefined;

  const parsedArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    branchRange,
    functionName,
    parenthesisPairs,
  );
  if (parsedArguments === undefined) return hasFallbackChild ? undefined : false;
  const numericArgumentRanges = randomNumericArgumentRanges(value, parsedArguments);
  if (numericArgumentRanges === undefined) return hasFallbackChild ? undefined : false;
  const numericArgumentStarts = new Set(
    numericArgumentRanges.map((argumentRange) => argumentRange.start),
  );
  const staticNumericArguments = parsedArguments.staticArguments.filter((argument) =>
    numericArgumentStarts.has(argument.range.start),
  );
  if (staticNumericArguments.length !== numericArgumentRanges.length) return undefined;
  if (!runtimeFunctionStaticArgumentsAreValid(functionName, parsedArguments, numericArgumentRanges))
    return false;
  return staticNumericArguments.every(
    (argument) => analyzeStaticLayerValue(argument.value).resultType === 'number',
  );
}

function firstValidBranchIsKnownRuntimeFunction(value, frame, branchRange, parenthesisPairs) {
  const identifierEnd = cssIdentifierTokenEnd(value, branchRange.start);
  if (value[identifierEnd] !== '(' || parenthesisPairs.get(identifierEnd) !== branchRange.end - 1)
    return false;
  const functionName = value.slice(branchRange.start, identifierEnd).toLowerCase();
  if (
    !progressFunctionNames.has(functionName) &&
    functionName !== 'random' &&
    functionName !== 'random-item' &&
    !treeCountingFunctionNames.has(functionName)
  )
    return false;
  return (
    firstValidRuntimeFunctionStaticValidity(
      value,
      frame,
      branchRange,
      functionName,
      parenthesisPairs,
    ) === true
  );
}

function conditionalWholeValueStaticValidity(value, group, parenthesisPairs) {
  if (group.functionName === 'first-valid') {
    const branchRanges = firstValidBranchValueRanges(value, group, parenthesisPairs);
    if (branchRanges === undefined || branchRanges === fallbackResolutionTooComplex)
      return undefined;
    if (branchRanges.length === 0) return false;
    const validities = branchRanges.map((branchRange) =>
      firstValidBranchStaticValidity(value, group, branchRange, parenthesisPairs),
    );
    if (validities.includes(true)) return true;
    return validities.every((validity) => validity === false) ? false : undefined;
  }

  const analysis = ifBranchAnalysis(value, group, parenthesisPairs);
  if (analysis === undefined || analysis === fallbackResolutionTooComplex) return undefined;
  if (!analysis.hasGuaranteedSelection || analysis.branchRanges.length === 0) return undefined;
  const validities = analysis.branchRanges.map((branchRange) =>
    firstValidBranchStaticValidity(value, group, branchRange, parenthesisPairs),
  );
  if (validities.every((validity) => validity === true)) return true;
  return validities.every((validity) => validity === false) ? false : undefined;
}

function firstValidBranchStaticValidity(value, group, branchRange, parenthesisPairs) {
  const branchValue = value.slice(branchRange.start, branchRange.end);
  if (validZIndexWholeValueKeywords.has(branchValue.trim().toLowerCase())) return true;

  const identifierEnd = cssIdentifierTokenEnd(value, branchRange.start);
  if (identifierEnd === branchRange.end) return false;
  if (value[identifierEnd] === '(') {
    const closeIndex = parenthesisPairs.get(identifierEnd);
    if (closeIndex !== branchRange.end - 1) return false;
    const functionName = value.slice(branchRange.start, identifierEnd).toLowerCase();
    const conditionalGroup = group.conditionalChildren.find(
      (candidate) =>
        candidate.functionStart === branchRange.start && candidate.end === branchRange.end,
    );
    if (conditionalGroup !== undefined)
      return conditionalWholeValueStaticValidity(value, conditionalGroup, parenthesisPairs);
    const runtimeValidity = firstValidRuntimeFunctionStaticValidity(
      value,
      group.conditionalOwner,
      branchRange,
      functionName,
      parenthesisPairs,
    );
    if (runtimeValidity !== undefined) return runtimeValidity;
  }
  if (
    group.conditionalOwner.children.some(
      (child) => child.start >= branchRange.start && child.end <= branchRange.end,
    )
  )
    return undefined;

  const analysis = analyzeStaticLayerValue(branchValue);
  if (analysis.resultType === 'number' && !isStaticallyInvalidArithmetic(branchValue)) {
    const isIntegerToken = /^[+-]?\d+$/.test(branchValue.trim());
    const isWholeMathFunction =
      value[identifierEnd] === '(' && parenthesisPairs.get(identifierEnd) === branchRange.end - 1;
    return isIntegerToken || isWholeMathFunction;
  }
  if (analysis.resultType === 'non-number') return false;
  if (analysis.resultType === 'too-complex') return undefined;

  if (value[identifierEnd] !== '(') return false;
  const closeIndex = parenthesisPairs.get(identifierEnd);
  if (closeIndex !== branchRange.end - 1) return false;
  const functionName = value.slice(branchRange.start, identifierEnd).toLowerCase();
  return mathFunctionNames.has(functionName) || conditionalFunctionNames.has(functionName)
    ? undefined
    : false;
}

function firstValidBranchValueRanges(value, group, parenthesisPairs) {
  const branchRanges = [];
  let branchStart = group.openIndex + 1;
  const appendBranch = (branchEnd) => {
    const branchRange = trimCssTriviaRange(value, branchStart, branchEnd);
    if (branchRange.start === branchRange.end) return false;
    branchRanges.push(branchRange);
    return true;
  };

  for (let index = branchStart; index < group.end - 1; index += 1) {
    if (value[index] === '"' || value[index] === "'") index = quotedStringEnd(value, index);
    else {
      const urlTokenEnd = unquotedUrlTokenEnd(value, index);
      if (urlTokenEnd !== undefined) index = urlTokenEnd;
      else if (value[index] === '(') {
        const closeIndex = parenthesisPairs.get(index);
        if (closeIndex === undefined || closeIndex >= group.end) return undefined;
        index = closeIndex;
      } else if (value[index] === ')') return undefined;
      else if (value[index] === ',') {
        if (!appendBranch(index)) return undefined;
        branchStart = index + 1;
      }
    }
  }
  if (!appendBranch(group.end - 1)) return undefined;

  const selectableBranches = [];
  for (const branchRange of branchRanges) {
    const validity = firstValidBranchStaticValidity(value, group, branchRange, parenthesisPairs);
    if (validity === false) continue;
    selectableBranches.push(branchRange);
    if (validity === true) break;
  }
  return selectableBranches;
}

function ifBranchAnalysis(value, group, parenthesisPairs) {
  const branches = [];
  let hasUnconditionalBranch = false;
  let branchStart = group.openIndex + 1;
  const appendBranch = (branchEnd) => {
    const branchRange = trimCssTriviaRange(value, branchStart, branchEnd);
    if (branchRange.start === branchRange.end)
      return branchEnd === group.end - 1 && branches.length > 0;

    let separatorIndex = -1;
    for (let index = branchRange.start; index < branchRange.end; index += 1) {
      if (value[index] === '"' || value[index] === "'") index = quotedStringEnd(value, index);
      else {
        const urlTokenEnd = unquotedUrlTokenEnd(value, index);
        if (urlTokenEnd !== undefined) index = urlTokenEnd;
        else if (value[index] === '(') {
          const closeIndex = parenthesisPairs.get(index);
          if (closeIndex === undefined || closeIndex >= branchRange.end) return false;
          index = closeIndex;
        } else if (value[index] === ')') return false;
        else if (value[index] === ':') {
          separatorIndex = index;
          break;
        }
      }
    }
    if (separatorIndex === -1) return false;

    const conditionRange = trimCssTriviaRange(value, branchRange.start, separatorIndex);
    const branchValueRange = trimCssTriviaRange(value, separatorIndex + 1, branchRange.end);
    if (conditionRange.start === conditionRange.end) return false;
    const condition = value
      .slice(conditionRange.start, conditionRange.end)
      .replaceAll(cssCommentMaskCharacter, ' ')
      .trim()
      .toLowerCase();
    const isUnconditionalBranch = condition === 'else';
    let conditionTruth;
    if (!isUnconditionalBranch) {
      const conditionResult = isValidConditionalBooleanExpression(
        value,
        conditionRange,
        parenthesisPairs,
      );
      if (conditionResult === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
      if (!conditionResult) return true;
      conditionTruth = conditionalBooleanStaticTruth(value, conditionRange, parenthesisPairs);
      if (conditionTruth === false) return true;
    }
    if (!hasUnconditionalBranch) branches.push(branchValueRange);
    hasUnconditionalBranch ||= isUnconditionalBranch || conditionTruth === true;
    return true;
  };

  for (let index = branchStart; index < group.end - 1; index += 1) {
    if (value[index] === '"' || value[index] === "'") index = quotedStringEnd(value, index);
    else {
      const urlTokenEnd = unquotedUrlTokenEnd(value, index);
      if (urlTokenEnd !== undefined) index = urlTokenEnd;
      else if (value[index] === '(') {
        const closeIndex = parenthesisPairs.get(index);
        if (closeIndex === undefined || closeIndex >= group.end) return undefined;
        index = closeIndex;
      } else if (value[index] === ')') return undefined;
      else if (value[index] === ';') {
        const appendResult = appendBranch(index);
        if (appendResult === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
        if (!appendResult) return undefined;
        branchStart = index + 1;
      }
    }
  }
  const finalAppendResult = appendBranch(group.end - 1);
  if (finalAppendResult === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
  if (!finalAppendResult) return undefined;
  return { branchRanges: branches, hasGuaranteedSelection: hasUnconditionalBranch };
}

function conditionalBranchValueRanges(value, group, parenthesisPairs) {
  if (group.end === undefined) return undefined;
  if (group.functionName === 'first-valid')
    return firstValidBranchValueRanges(value, group, parenthesisPairs);
  if (group.functionName !== 'if') return undefined;
  const analysis = ifBranchAnalysis(value, group, parenthesisPairs);
  if (analysis === undefined || analysis === fallbackResolutionTooComplex) return analysis;
  return analysis.branchRanges;
}

function rangeIsValidConditionalExpression(frame, value, range, parenthesisPairs) {
  const expressionRange = unwrapStaticContainer(value, range, parenthesisPairs);
  return frame.conditionalGroups.some(
    (group) =>
      group.functionStart === expressionRange.start &&
      group.end === expressionRange.end &&
      Array.isArray(conditionalBranchValueRanges(value, group, parenthesisPairs)),
  );
}

function childIsInSelectableConditionalBranch(child, value, parenthesisPairs, ownerRange) {
  let conditionalParent = child.conditionalParent;
  let selectableRange = { start: child.start, end: child.end };
  while (conditionalParent !== undefined) {
    if (
      conditionalParent.functionName === 'first-valid' &&
      conditionalParent.enclosingConditionalParent === undefined
    ) {
      const ownerExpressionRange = trimCssTriviaRange(value, ownerRange.start, ownerRange.end);
      if (
        conditionalParent.functionStart !== ownerExpressionRange.start ||
        conditionalParent.end !== ownerExpressionRange.end
      )
        return false;
    }
    const branchRanges = conditionalBranchValueRanges(value, conditionalParent, parenthesisPairs);
    if (branchRanges === fallbackResolutionTooComplex) return true;
    if (
      branchRanges === undefined ||
      !branchRanges.some(
        (branchRange) =>
          selectableRange.start >= branchRange.start && selectableRange.end <= branchRange.end,
      )
    )
      return false;
    selectableRange = { start: conditionalParent.functionStart, end: conditionalParent.end };
    conditionalParent = conditionalParent.enclosingConditionalParent;
  }
  return true;
}

function contextualProgressFeatureWitness(value, range, functionName) {
  const header = value
    .slice(range.start, range.end)
    .replaceAll(cssCommentMaskCharacter, ' ')
    .trim();
  const tokens = header.split(/\s+/);
  const featureName = tokens[0]?.toLowerCase();
  if (functionName === 'media-progress') {
    if (tokens.length !== 1) return undefined;
    return mediaProgressFeatureWitnesses.get(featureName);
  }
  if (tokens.length !== 1 && tokens.length !== 3) return undefined;
  if (tokens.length === 3) {
    const containerName = tokens[2];
    if (
      tokens[1].toLowerCase() !== 'of' ||
      cssIdentifierTokenEnd(containerName, 0) !== containerName.length ||
      invalidCustomIdentKeywords.has(containerName.toLowerCase()) ||
      containerName.toLowerCase() === 'none'
    )
      return undefined;
  }
  return containerProgressFeatureWitnesses.get(featureName);
}

function contextualIntegerEndpointIsValid(value, argument, parenthesisPairs) {
  if (/^[+-]?\d+$/.test(argument.value.trim())) return true;
  const identifierEnd = cssIdentifierTokenEnd(value, argument.range.start);
  const functionName = value.slice(argument.range.start, identifierEnd).toLowerCase();
  return (
    mathFunctionNames.has(functionName) &&
    value[identifierEnd] === '(' &&
    parenthesisPairs.get(identifierEnd) === argument.range.end - 1
  );
}

function progressRangeMode(frame, value, range, parenthesisPairs) {
  const functionName = range.parenthesis?.functionName ?? 'progress';
  const parsedArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    range,
    functionName,
    parenthesisPairs,
  );
  if (parsedArguments?.argumentCount !== 3) return 'invalid';
  if (contextualProgressFunctionNames.has(functionName)) {
    const featureWitness = contextualProgressFeatureWitness(
      value,
      parsedArguments.argumentRanges[0],
      functionName,
    );
    if (featureWitness === undefined) return 'invalid';
    const staticEndpoints = parsedArguments.staticArguments
      .filter((argument) => argument.index > 0)
      .map((argument) => argument.value);
    if (!haveCompatibleStaticProgressTypes([featureWitness, ...staticEndpoints])) return 'invalid';
    const featureName = value
      .slice(
        parsedArguments.argumentRanges[0].start,
        cssIdentifierTokenEnd(value, parsedArguments.argumentRanges[0].start),
      )
      .toLowerCase();
    if (
      integerMediaProgressFeatureNames.has(featureName) &&
      parsedArguments.staticArguments.some(
        (argument) =>
          argument.index > 0 &&
          !contextualIntegerEndpointIsValid(value, argument, parenthesisPairs),
      )
    )
      return 'invalid';
    return 'unclamped';
  }
  const firstArgumentRange = parsedArguments.argumentRanges[0];
  const firstArgumentStart = trimCssTriviaRange(
    value,
    firstArgumentRange.start,
    firstArgumentRange.end,
  ).start;
  const firstArgumentPrefix = value.slice(firstArgumentStart, firstArgumentStart + 8);
  const noClampEnd = firstArgumentStart + firstArgumentPrefix.length;
  const hasNoClampPrefix =
    firstArgumentPrefix.toLowerCase() === 'no-clamp' && isCssWhitespaceOrComment(value[noClampEnd]);
  if (
    !haveCompatibleStaticProgressTypes(
      parsedArguments.staticArguments.map((argument) => argument.value),
    )
  )
    return 'invalid';
  return hasNoClampPrefix ? 'unclamped' : 'clamped';
}

function isValidProgressRange(frame, value, range, parenthesisPairs) {
  return progressRangeMode(frame, value, range, parenthesisPairs) === 'clamped';
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
  const functionName = range.parenthesis?.functionName ?? 'progress';
  const parsedArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    range,
    functionName,
    parenthesisPairs,
  );
  if (parsedArguments?.argumentCount !== 3) return undefined;
  return `${functionName}\u0000${parsedArguments.argumentRanges
    .map((argumentRange) => canonicalProgressArgument(value, argumentRange))
    .join('\u0001')}`;
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
  for (const functionName of [
    'max',
    'min',
    'clamp',
    'round',
    'mod',
    'rem',
    'pow',
    'log',
    'hypot',
  ]) {
    const parsedArguments = fallbackIndependentStaticArguments(
      frame,
      value,
      range,
      functionName,
      parenthesisPairs,
    );
    if (!parsedArguments) continue;
    if (functionName === 'clamp' && parsedArguments.argumentCount !== 3) return [];
    if (
      (functionName === 'mod' ||
        functionName === 'rem' ||
        functionName === 'pow' ||
        functionName === 'log') &&
      parsedArguments.argumentCount !== 2
    )
      return [];
    if (
      extremaFunctionNames.has(functionName) &&
      parsedArguments.staticArguments.some((argument) =>
        isStaticallyInvalidArithmetic(argument.value),
      )
    )
      return [];
    if (
      (functionName === 'mod' ||
        functionName === 'rem' ||
        functionName === 'pow' ||
        functionName === 'log') &&
      parsedArguments.staticArguments.length === parsedArguments.argumentCount
    )
      return [];
    if (functionName !== 'round') {
      const staticResultTypes = new Set(
        parsedArguments.staticArguments.map(
          (argument) => analyzeStaticLayerValue(argument.value).resultType,
        ),
      );
      if (staticResultTypes.has('number') && staticResultTypes.has('non-number')) return [];
      if ((functionName === 'pow' || functionName === 'log') && staticResultTypes.has('non-number'))
        return [];
    }
    let candidateArguments;
    if (functionName === 'clamp') candidateArguments = parsedArguments.staticArguments;
    else if (functionName === 'round') {
      const firstArgument = value
        .slice(parsedArguments.argumentRanges[0].start, parsedArguments.argumentRanges[0].end)
        .replaceAll(cssCommentMaskCharacter, ' ')
        .trim()
        .toLowerCase();
      if (firstArgument === 'line-width') return [];
      const hasStrategy = roundingStrategyNames.has(firstArgument);
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
    } else if (functionName === 'log')
      candidateArguments = parsedArguments.staticArguments.filter((argument) => {
        const numericValue = evaluateStaticLayerNumber(argument.value);
        return (
          numericValue !== undefined &&
          Number.isFinite(numericValue) &&
          numericValue > 0 &&
          numericValue !== 1
        );
      });
    else candidateArguments = parsedArguments.staticArguments;
    if (functionName === 'hypot') {
      const staticValues = candidateArguments.map((argument) =>
        evaluateStaticLayerNumber(argument.value),
      );
      if (staticValues.some((staticValue) => staticValue === undefined)) return [];
      let minimumResult = 0;
      for (const staticValue of staticValues)
        minimumResult = Math.hypot(minimumResult, staticValue);
      return minimumResult < 9999.5
        ? [
            {
              ...candidate,
              resolvedClassification: 'magic',
              hasRuntimeSibling: true,
            },
          ]
        : [];
    }
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
  for (const functionName of [
    'max',
    'min',
    'clamp',
    'round',
    'mod',
    'rem',
    'pow',
    'log',
    'hypot',
  ]) {
    const parsedArguments = fallbackIndependentStaticArguments(
      frame,
      value,
      range,
      functionName,
      parenthesisPairs,
    );
    if (!parsedArguments) continue;
    if (functionName === 'clamp' && parsedArguments.argumentCount !== 3) return new Set();
    if (
      (functionName === 'mod' ||
        functionName === 'rem' ||
        functionName === 'pow' ||
        functionName === 'log') &&
      parsedArguments.argumentCount !== 2
    )
      return new Set();
    let staticArguments = parsedArguments.staticArguments;
    if (functionName === 'round') {
      const firstArgument = value
        .slice(parsedArguments.argumentRanges[0].start, parsedArguments.argumentRanges[0].end)
        .replaceAll(cssCommentMaskCharacter, ' ')
        .trim()
        .toLowerCase();
      if (firstArgument === 'line-width') return new Set();
      const hasStrategy = roundingStrategyNames.has(firstArgument);
      const validArgumentCount = hasStrategy
        ? parsedArguments.argumentCount === 2 || parsedArguments.argumentCount === 3
        : parsedArguments.argumentCount === 1 || parsedArguments.argumentCount === 2;
      if (!validArgumentCount) return new Set();
      staticArguments = parsedArguments.staticArguments.filter(
        (argument) => !hasStrategy || argument.index !== 0,
      );
    }
    const resultTypes = new Set(
      staticArguments
        .map((argument) => analyzeStaticLayerValue(argument.value).resultType)
        .filter((resultType) => resultType === 'number' || resultType === 'non-number'),
    );
    return (functionName === 'pow' || functionName === 'log') && resultTypes.has('non-number')
      ? new Set()
      : resultTypes;
  }
  return new Set();
}

function fallbackIndependentLowerBound(frame, value, range, budget, parenthesisPairs) {
  const expressionRange = unwrapStaticContainer(value, range, parenthesisPairs);
  if (!consumeResolutionWork(budget, expressionRange.end - expressionRange.start)) return undefined;
  const terms = [];
  let direction = 1;
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
    terms.push({
      direction,
      range: trimCssTriviaRange(value, termStart, index),
    });
    direction = value[index] === '+' ? 1 : -1;
    termStart = index + 1;
  }
  terms.push({
    direction,
    range: trimCssTriviaRange(value, termStart, expressionRange.end),
  });

  let lowerBound = 0;
  let childIndex = firstChildEndingAfter(frame.children, expressionRange.start);
  for (const term of terms) {
    while (frame.children[childIndex]?.end <= term.range.start) childIndex += 1;
    const children = [];
    while (
      frame.children[childIndex]?.start < term.range.end &&
      frame.children[childIndex].end <= term.range.end
    ) {
      children.push(frame.children[childIndex]);
      childIndex += 1;
    }
    if (children.length === 0) {
      const staticValue = evaluateStaticLayerNumber(value.slice(term.range.start, term.range.end));
      if (staticValue === undefined || !Number.isFinite(staticValue)) return undefined;
      lowerBound += term.direction * staticValue;
      continue;
    }
    if (term.direction < 0) return undefined;

    const parsedAbsoluteValue = fallbackIndependentStaticArguments(
      frame,
      value,
      term.range,
      'abs',
      parenthesisPairs,
    );
    if (parsedAbsoluteValue?.argumentCount === 1) continue;

    const parsedMaximum = fallbackIndependentStaticArguments(
      frame,
      value,
      term.range,
      'max',
      parenthesisPairs,
    );
    if (parsedMaximum !== undefined) {
      const staticValues = parsedMaximum.staticArguments.map((argument) =>
        evaluateStaticLayerNumber(argument.value),
      );
      if (
        staticValues.length === 0 ||
        staticValues.some((staticValue) => staticValue === undefined)
      )
        return undefined;
      let maximumStaticValue = -Infinity;
      for (const staticValue of staticValues)
        maximumStaticValue = Math.max(maximumStaticValue, staticValue);
      lowerBound += maximumStaticValue;
      continue;
    }

    const parsedClamp = fallbackIndependentStaticArguments(
      frame,
      value,
      term.range,
      'clamp',
      parenthesisPairs,
    );
    const clampMinimum = parsedClamp?.staticArguments.find((argument) => argument.index === 0);
    if (parsedClamp?.argumentCount === 3 && clampMinimum !== undefined) {
      const staticMinimum = evaluateStaticLayerNumber(clampMinimum.value);
      if (staticMinimum === undefined || !Number.isFinite(staticMinimum)) return undefined;
      lowerBound += staticMinimum;
      continue;
    }

    if (isValidProgressRange(frame, value, term.range, parenthesisPairs)) continue;
    return undefined;
  }
  return lowerBound;
}

function signRangeCandidates(
  frame,
  value,
  range,
  candidate,
  budget,
  parenthesisPairs,
  zeroQuotientRanges,
  selectableChildren,
) {
  const unresolvedChildren = frame.children.filter(
    (child) => child.resolvedFallback === null && selectableChildren.has(child),
  );
  const hasUnselectableChild = frame.children.some((child) => !selectableChildren.has(child));
  const emptyAnalysis = { analyzedRanges: [], candidates: [], suppressedChild: undefined };
  if (unresolvedChildren.length === 0) return emptyAnalysis;
  const signParents = [];
  const signParentSet = new Set();
  for (const child of unresolvedChildren) {
    const signParent = child.signParent;
    if (
      signParent?.end === undefined ||
      signParent.functionStart < range.start ||
      signParent.end > range.end
    )
      return emptyAnalysis;
    if (!signParentSet.has(signParent)) {
      signParentSet.add(signParent);
      signParents.push(signParent);
    }
  }
  const signRanges = signParents
    .map((parenthesis) => ({
      end: parenthesis.end,
      parenthesis,
      start: parenthesis.functionStart,
    }))
    .sort((left, right) => left.start - right.start);
  const tooComplexAnalysis = () => ({
    analyzedRanges: [],
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
    signRanges.some((signRange) => signRange.start < range.start || signRange.end > range.end) ||
    signRanges.some((signRange, index) => index > 0 && signRanges[index - 1].end > signRange.start)
  )
    return tooComplexAnalysis();
  const parsedSignArguments = signRanges.map((signRange) =>
    fallbackIndependentStaticArguments(frame, value, signRange, 'sign', parenthesisPairs),
  );
  if (parsedSignArguments.some((parsedArguments) => parsedArguments?.argumentCount !== 1))
    return emptyAnalysis;
  const childrenOutsideSignRanges = frame.children.filter(
    (child) => selectableChildren.has(child) && !signParentSet.has(child.signParent),
  );
  if (childrenOutsideSignRanges.some((child) => child.resolvedFallback === null))
    return emptyAnalysis;
  const signGroupIndexes = new Map();
  const signGroupEndpoints = [];
  const signRangeGroupIndexes = parsedSignArguments.map((parsedArguments, signRangeIndex) => {
    const signRange = signRanges[signRangeIndex];
    if (
      zeroQuotientRanges.some(
        (zeroRange) => zeroRange.start <= signRange.start && zeroRange.end >= signRange.end,
      )
    )
      return undefined;
    const argumentRange = parsedArguments.argumentRanges[0];
    const key = canonicalProgressArgument(value, argumentRange);
    const existingIndex = signGroupIndexes.get(key);
    if (existingIndex !== undefined) return existingIndex;
    const groupIndex = signGroupIndexes.size;
    signGroupIndexes.set(key, groupIndex);
    const lowerBound = frame.signedZeroSensitiveContext
      ? undefined
      : fallbackIndependentLowerBound(frame, value, argumentRange, budget, parenthesisPairs);
    signGroupEndpoints.push(
      lowerBound === undefined || lowerBound < 0 ? [-1, 0, 1] : lowerBound === 0 ? [0, 1] : [1],
    );
    return groupIndex;
  });
  const resolvedChildren = childrenOutsideSignRanges;
  if (resolvedChildren.some((child) => typeof child.resolvedFallback !== 'string'))
    return emptyAnalysis;
  const replacementRanges = [
    ...signRanges.map((signRange, index) => ({
      ...signRange,
      groupIndex: signRangeGroupIndexes[index],
      type: signRangeGroupIndexes[index] === undefined ? 'zero-sign' : 'sign',
    })),
    ...resolvedChildren.map((child) => ({
      end: child.end,
      replacement: ` ${child.resolvedFallback} `,
      start: child.start,
      type: 'fallback',
    })),
  ].sort((left, right) => left.start - right.start);
  const signGroupStrides = [];
  let combinationCount = 1;
  for (const endpoints of signGroupEndpoints) {
    signGroupStrides.push(combinationCount);
    combinationCount *= endpoints.length;
  }
  const replacementLength = resolvedChildren.reduce(
    (total, child) => total + child.resolvedFallback.length + 2,
    0,
  );
  const endpointModeCount = resolvedChildren.length === 0 ? 1 : 2;
  const generatedLength =
    combinationCount * endpointModeCount * (range.end - range.start + replacementLength);
  if (!Number.isSafeInteger(combinationCount) || !consumeResolutionWork(budget, generatedLength))
    return tooComplexAnalysis();
  const classifications = new Set();
  for (let combination = 0; combination < combinationCount; combination += 1) {
    let resolvedEndpointCount = 0;
    for (let endpointMode = 0; endpointMode < endpointModeCount; endpointMode += 1) {
      const useFallbackValues = endpointMode === 0;
      const chunks = [];
      let cursor = range.start;
      for (const replacementRange of replacementRanges) {
        chunks.push(value.slice(cursor, replacementRange.start));
        if (replacementRange.type === 'sign') {
          const endpoints = signGroupEndpoints[replacementRange.groupIndex];
          const endpointIndex =
            Math.floor(combination / signGroupStrides[replacementRange.groupIndex]) %
            endpoints.length;
          chunks.push(String(endpoints[endpointIndex]));
        } else if (replacementRange.type === 'zero-sign') chunks.push('0');
        else chunks.push(useFallbackValues ? replacementRange.replacement : ' 0 ');
        cursor = replacementRange.end;
      }
      chunks.push(value.slice(cursor, range.end));
      const classification = classifyStaticLayer(chunks.join(''));
      if (classification === 'too-complex') return tooComplexAnalysis();
      if (classification === 'unresolved') continue;
      resolvedEndpointCount += 1;
      if (classification === 'negative' || classification === 'magic')
        classifications.add(classification);
    }
    if (resolvedEndpointCount === 0)
      return hasUnselectableChild ? tooComplexAnalysis() : emptyAnalysis;
  }
  const candidateBearingResolvedChildren = resolvedChildren.filter(
    (child) => child.unprovenBannedCandidates.length > 0,
  );
  return {
    analyzedRanges: signRanges,
    candidates: [...classifications].map((resolvedClassification) => ({
      ...candidate,
      resolvedClassification,
    })),
    suppressedChild:
      classifications.size === 0 &&
      resolvedChildren.length === 1 &&
      candidateBearingResolvedChildren.length === 1
        ? candidateBearingResolvedChildren[0]
        : undefined,
  };
}

function progressRangeCandidates(
  frame,
  value,
  range,
  candidate,
  budget,
  parenthesisPairs,
  selectableChildren,
) {
  const unresolvedChildren = frame.children.filter(
    (child) => child.resolvedFallback === null && selectableChildren.has(child),
  );
  const emptyAnalysis = { candidates: [], suppressedChild: undefined };
  const progressParents = [];
  const progressParentSet = new Set();
  const trimmedRange = trimCssTriviaRange(value, range.start, range.end);
  for (const progressGroup of frame.progressGroups) {
    const isWholeSelectedRange =
      progressGroup.functionStart === trimmedRange.start && progressGroup.end === trimmedRange.end;
    if (
      progressGroup.end === undefined ||
      progressGroup.functionStart < range.start ||
      progressGroup.end > range.end ||
      (!isWholeSelectedRange &&
        !childIsInSelectableConditionalBranch(
          {
            start: progressGroup.functionStart,
            end: progressGroup.end,
            conditionalParent: progressGroup.conditionalParent,
          },
          value,
          parenthesisPairs,
          range,
        ))
    )
      continue;
    progressParentSet.add(progressGroup);
    progressParents.push(progressGroup);
  }
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
  if (progressParents.length === 0) return emptyAnalysis;
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
    (child) => selectableChildren.has(child) && !progressParentSet.has(child.progressParent),
  );
  if (childrenOutsideProgressRanges.some((child) => child.resolvedFallback === null))
    return emptyAnalysis;
  let hasUnclampedProgressRange = false;
  for (const progressRange of progressRanges) {
    const mode = progressRangeMode(frame, value, progressRange, parenthesisPairs);
    if (mode === 'invalid') return emptyAnalysis;
    if (mode === 'unclamped') hasUnclampedProgressRange = true;
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
  const endpointExpressions = [];
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
    const endpointExpression = chunks.join('');
    endpointExpressions.push(endpointExpression);
    const endpointValue = evaluateStaticLayerNumber(endpointExpression);
    if (endpointValue === undefined) return emptyAnalysis;
    minimum = Math.min(minimum, endpointValue);
    maximum = Math.max(maximum, endpointValue);
  }
  if (hasUnclampedProgressRange && !haveEqualStaticArithmeticValues(endpointExpressions))
    return tooComplexAnalysis();
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
  centerExpressionIsKnownValid = false,
) {
  const clampArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    range,
    'clamp',
    parenthesisPairs,
  );
  if (clampArguments?.argumentCount !== 3) return false;
  const centerIsKnownValid =
    centerExpressionIsKnownValid ||
    rangeIsValidConditionalExpression(
      frame,
      value,
      clampArguments.argumentRanges[1],
      parenthesisPairs,
    );
  if (!centerIsKnownValid) {
    const centerExpression = argumentWithFallbackPlaceholders(
      frame,
      value,
      clampArguments.argumentRanges[1],
      budget,
    );
    if (centerExpression === undefined) return false;
    if (!['safe', 'negative', 'magic'].includes(classifyStaticLayer(centerExpression)))
      return false;
  }
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
  if (syntax[0] === '"' || syntax[0] === "'") {
    const closingQuoteIndex = quotedStringEnd(syntax, 0);
    return closingQuoteIndex === syntax.length - 1 && syntax[closingQuoteIndex] === syntax[0];
  }

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
      /^(?:\s+(?:\+?\d+|-0+))*$/.test(header.slice(identifierEnd))
    );
  if (frame.functionName !== 'attr') return false;
  const attrType = header.slice(identifierEnd).trim();
  if (attrType === '' || attrType === '%') return true;
  if (cssIdentifierTokenEnd(attrType, 0) === attrType.length)
    return !invalidCustomIdentKeywords.has(attrType.toLowerCase());
  const typeMatch = /^type\(([^()]+)\)$/i.exec(attrType);
  if (!typeMatch) return false;
  return validAttrTypeSyntax(typeMatch[1]);
}

function substitutionDefinedPathCanBeNumber(frame, value) {
  if (frame.functionName === 'var') return true;
  if (frame.functionName === 'env') {
    const header = value
      .slice(frame.openIndex + 1, frame.commaIndex)
      .replaceAll(cssCommentMaskCharacter, ' ')
      .trim();
    const scalarLengthEnvironmentVariable =
      /^safe-area-(?:max-)?inset-(?:top|right|bottom|left)$/i.test(header);
    const indexedLengthEnvironmentVariable =
      /^viewport-segment-(?:width|height|top|right|bottom|left)(?:\s|$)/i.test(header);
    return !scalarLengthEnvironmentVariable && !indexedLengthEnvironmentVariable;
  }
  if (frame.functionName !== 'attr') return false;
  const header = value
    .slice(frame.openIndex + 1, frame.commaIndex)
    .replaceAll(cssCommentMaskCharacter, ' ')
    .trim();
  const identifierEnd = cssIdentifierTokenEnd(header, 0);
  const attrType = header.slice(identifierEnd).trim();
  const typeMatch = /^type\(([^()]+)\)$/i.exec(attrType);
  return typeMatch !== null && /(?:^|[<"'])(?:integer|number)(?:>|["']|$)/i.test(typeMatch[1]);
}

function substitutionDefinedPathIdentity(frame, value) {
  if (frame.functionName !== 'var') return undefined;
  const header = value
    .slice(frame.openIndex + 1, frame.commaIndex)
    .replaceAll(cssCommentMaskCharacter, ' ')
    .trim();
  return `var:${header}`;
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
        context.functionName !== 'random' &&
        context.functionName !== 'random-item' &&
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
      if (
        character === '/' &&
        parenthesisContexts.at(-1)?.functionName === 'media' &&
        isMediaFeatureRatioSlash(value, index, range.start, range.end)
      )
        continue;
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

function isMediaFeatureRatioSlash(value, slashIndex, rangeStart, rangeEnd) {
  let leftEnd = slashIndex;
  while (leftEnd > rangeStart && isCssWhitespaceOrComment(value[leftEnd - 1])) leftEnd -= 1;
  let leftStart = leftEnd;
  while (leftStart > rangeStart && /[+\-.\de]/i.test(value[leftStart - 1])) leftStart -= 1;
  const leftNumber = cssNumericToken(value, leftStart);
  if (leftNumber?.end !== leftEnd || leftNumber.hasUnit) return false;

  let rightStart = slashIndex + 1;
  while (rightStart < rangeEnd && isCssWhitespaceOrComment(value[rightStart])) rightStart += 1;
  const rightNumber = cssNumericToken(value, rightStart);
  return rightNumber !== undefined && !rightNumber.hasUnit;
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

function childFunctionParent(child, parentKey, range) {
  const parent = child.parenthesisParent?.[parentKey];
  return parent?.end !== undefined && parent.functionStart >= range.start && parent.end <= range.end
    ? parent
    : undefined;
}

function functionParentIsMultipliedByStaticZero(value, range, parent, budget) {
  if (parent.parentRequiresSignedZero) return false;
  return expressionRangeIsMultipliedByStaticZero(
    value,
    range,
    parent.functionStart,
    parent.end,
    budget,
  );
}

function unresolvedExtremaRangeCandidates(
  frame,
  value,
  range,
  candidate,
  budget,
  parenthesisPairs,
  suppressedRuntimeFunctionRanges,
  selectableChildren,
) {
  const failClosedCandidate = () => [
    {
      ...candidate,
      hasRuntimeSibling: true,
      resolvedFallback: fallbackResolutionTooComplex,
      resolvedClassification: 'too-complex',
    },
  ];
  const liveExtremaParents = new Set();
  for (const child of frame.children) {
    if (child.resolvedFallback !== null || !selectableChildren.has(child)) continue;
    const functionParent = childFunctionParent(child, 'extremaParent', range);
    if (
      suppressedRuntimeFunctionRanges.some(
        (suppressedRange) =>
          functionParent !== undefined &&
          functionParent.functionStart >= suppressedRange.start &&
          functionParent.end <= suppressedRange.end,
      )
    )
      continue;
    if (functionParent !== undefined) liveExtremaParents.add(functionParent);
  }
  if (liveExtremaParents.size === 0) return [];
  const enclosingRange = unwrapStaticContainer(value, range, parenthesisPairs);
  if (
    [...liveExtremaParents].some(
      (functionParent) =>
        functionParent.functionStart === enclosingRange.start &&
        functionParent.end === enclosingRange.end,
    )
  )
    return [];
  if (liveExtremaParents.size > 1) return failClosedCandidate();

  const [functionParent] = liveExtremaParents;
  const functionRange = {
    start: functionParent.functionStart,
    end: functionParent.end,
  };
  const parsedArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    functionRange,
    functionParent.functionName,
    parenthesisPairs,
  );
  if (
    parsedArguments === undefined ||
    (functionParent.functionName === 'clamp' && parsedArguments.argumentCount !== 3) ||
    !haveCompatibleStaticProgressTypes(
      parsedArguments.staticArguments.map((argument) => argument.value),
    ) ||
    parsedArguments.staticArguments.some((argument) =>
      isStaticallyInvalidArithmetic(argument.value),
    )
  )
    return [];

  const classifications = new Set();
  for (const argument of parsedArguments.staticArguments) {
    const expression = resolveFrameExpressionWithRangeReplacements(frame, value, range, budget, [
      {
        end: functionRange.end,
        start: functionRange.start,
        value: argument.value,
      },
    ]);
    if (expression === fallbackResolutionTooComplex) return failClosedCandidate();
    const classification = analyzeFrameExpression(frame, expression, budget).classification;
    if (classification === 'too-complex') return failClosedCandidate();
    if (classification === 'negative' || classification === 'magic')
      classifications.add(classification);
  }
  if (classifications.size === 0) {
    let enclosingFunctionParent = functionParent.parenthesisParent;
    let hasNonlinearEnclosingFunction = false;
    while (
      enclosingFunctionParent?.type === 'group' &&
      enclosingFunctionParent.end !== undefined &&
      enclosingFunctionParent.functionStart >= range.start &&
      enclosingFunctionParent.end <= range.end
    ) {
      if (
        !enclosingFunctionParent.isGroupingParenthesis &&
        enclosingFunctionParent.functionName !== 'calc' &&
        enclosingFunctionParent.functionName !== '-webkit-calc'
      ) {
        hasNonlinearEnclosingFunction = true;
        break;
      }
      enclosingFunctionParent = enclosingFunctionParent.parenthesisParent;
    }
    if (
      hasNonlinearEnclosingFunction ||
      frame.children.some(
        (child) =>
          selectableChildren.has(child) &&
          (child.start < functionRange.start || child.end > functionRange.end),
      ) ||
      !progressExpressionIsMultilinear(value, range, [functionRange], [0], [], parenthesisPairs)
    )
      return failClosedCandidate();

    const staticNumericArguments = parsedArguments.staticArguments.map((argument) => ({
      index: argument.index,
      value: evaluateStaticLayerNumber(argument.value),
    }));
    if (staticNumericArguments.some((argument) => argument.value === undefined))
      return failClosedCandidate();

    let inputMinimum = Number.NEGATIVE_INFINITY;
    let inputMaximum = Number.POSITIVE_INFINITY;
    if (functionParent.functionName === 'max' && staticNumericArguments.length > 0)
      inputMinimum = Math.max(...staticNumericArguments.map((argument) => argument.value));
    else if (functionParent.functionName === 'min' && staticNumericArguments.length > 0)
      inputMaximum = Math.min(...staticNumericArguments.map((argument) => argument.value));
    else if (functionParent.functionName === 'clamp') {
      const minimum = staticNumericArguments.find((argument) => argument.index === 0)?.value;
      const maximum = staticNumericArguments.find((argument) => argument.index === 2)?.value;
      if (minimum === undefined || maximum === undefined) return failClosedCandidate();
      inputMinimum = minimum;
      inputMaximum = Math.max(minimum, maximum);
    }

    const endpointValues = [];
    for (const extremaValue of [0, 1]) {
      const expression = resolveFrameExpressionWithRangeReplacements(frame, value, range, budget, [
        {
          end: functionRange.end,
          start: functionRange.start,
          value: String(extremaValue),
        },
      ]);
      if (expression === fallbackResolutionTooComplex) return failClosedCandidate();
      const endpointValue = evaluateStaticLayerNumber(expression);
      if (endpointValue === undefined || !Number.isFinite(endpointValue))
        return failClosedCandidate();
      endpointValues.push(endpointValue);
    }
    const [zeroValue, oneValue] = endpointValues;
    const coefficient = oneValue - zeroValue;
    const affineValue = (input) => {
      if (coefficient === 0) return zeroValue;
      if (input === Number.POSITIVE_INFINITY)
        return coefficient > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      if (input === Number.NEGATIVE_INFINITY)
        return coefficient > 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
      return zeroValue + coefficient * input;
    };
    const outputEndpoints = [affineValue(inputMinimum), affineValue(inputMaximum)];
    const outputMinimum = Math.min(...outputEndpoints);
    const outputMaximum = Math.max(...outputEndpoints);
    if (outputMinimum < -0.5) classifications.add('negative');
    if (outputMaximum >= 9998.5 && outputMinimum < 9999.5) classifications.add('magic');
  }
  return [...classifications].map((resolvedClassification) => ({
    ...candidate,
    hasRuntimeSibling: true,
    resolvedClassification,
  }));
}

function typedHypotRangeCandidates(
  frame,
  value,
  range,
  candidate,
  budget,
  parenthesisPairs,
  selectableChildren,
) {
  const childrenByHypotParent = new Map();
  for (const child of frame.children) {
    if (child.resolvedFallback !== null || !selectableChildren.has(child)) continue;
    const functionParent = childFunctionParent(child, 'hypotParent', range);
    if (functionParent === undefined) continue;
    const children = childrenByHypotParent.get(functionParent) ?? [];
    children.push(child);
    childrenByHypotParent.set(functionParent, children);
  }
  if (childrenByHypotParent.size === 0) return [];
  if (childrenByHypotParent.size > typedHypotParentLimit)
    return [
      {
        ...candidate,
        resolvedFallback: fallbackResolutionTooComplex,
        hasRuntimeSibling: true,
        resolvedClassification: 'too-complex',
      },
    ];
  const analyzedHypotParents = [];
  for (const [functionParent, children] of childrenByHypotParent) {
    const functionRange = { start: functionParent.functionStart, end: functionParent.end };
    const parsedArguments = fallbackIndependentStaticArguments(
      frame,
      value,
      functionRange,
      functionParent.functionName,
      parenthesisPairs,
    );
    if (parsedArguments === undefined || parsedArguments.argumentCount < 1) return [];
    if (
      parsedArguments.staticArguments.some((argument) =>
        isStaticallyInvalidArithmetic(argument.value),
      ) ||
      !haveCompatibleStaticProgressTypes(
        parsedArguments.staticArguments.map((argument) => argument.value),
      )
    )
      return [];
    if (
      !parsedArguments.staticArguments.some(
        (argument) => analyzeStaticLayerValue(argument.value).resultType === 'non-number',
      )
    ) {
      analyzedHypotParents.push({
        children,
        compatibleWitnesses: [],
        functionParent,
        functionRange,
      });
      continue;
    }
    const compatibleWitnesses = [];
    for (const witness of typedZeroWitnessValues) {
      const parentExpression = resolveFrameExpressionWithRangeReplacements(
        frame,
        value,
        functionRange,
        budget,
        children.map((child) => ({ end: child.end, start: child.start, value: witness })),
      );
      if (parentExpression === fallbackResolutionTooComplex)
        return [
          {
            ...candidate,
            resolvedFallback: fallbackResolutionTooComplex,
            resolvedClassification: 'too-complex',
          },
        ];
      if (
        !isStaticallyInvalidArithmetic(parentExpression) &&
        analyzeStaticLayerValue(parentExpression).resultType === 'non-number'
      )
        compatibleWitnesses.push(witness);
    }
    analyzedHypotParents.push({ children, compatibleWitnesses, functionParent, functionRange });
  }
  if (analyzedHypotParents.length === 0) return [];
  analyzedHypotParents.sort((left, right) => left.functionRange.start - right.functionRange.start);
  const zeroProductRange = { ...range, frame };
  const eliminatedHypotParents = [];
  const liveHypotParents = [];
  for (const analyzedParent of analyzedHypotParents) {
    const elimination = functionParentIsMultipliedByStaticZero(
      value,
      zeroProductRange,
      analyzedParent.functionParent,
      budget,
    );
    if (elimination === fallbackResolutionTooComplex)
      return [
        {
          ...candidate,
          resolvedFallback: fallbackResolutionTooComplex,
          resolvedClassification: 'too-complex',
        },
      ];
    if (elimination) eliminatedHypotParents.push(analyzedParent);
    else liveHypotParents.push(analyzedParent);
  }
  if (liveHypotParents.length === 0) return [];
  if (liveHypotParents.length === 1) {
    const [onlyLiveHypotParent] = liveHypotParents;
    const enclosingRange = unwrapStaticContainer(value, range, parenthesisPairs);
    if (
      onlyLiveHypotParent.functionRange.start === enclosingRange.start &&
      onlyLiveHypotParent.functionRange.end === enclosingRange.end
    )
      return [];
  }
  if (analyzedHypotParents.some((parent) => parent.compatibleWitnesses.length === 0)) {
    const outerExpressionHasValidWitness = hypotRuntimeWitnessValues.some((witness) => {
      const expression = resolveFrameExpressionWithRangeReplacements(
        frame,
        value,
        range,
        budget,
        analyzedHypotParents.flatMap((parent) => {
          const parentWitness = parent.compatibleWitnesses[0];
          const nonzeroParentWitness =
            parentWitness === undefined ? witness : `1${parentWitness.slice(1)}`;
          return parent.children.map((child) => ({
            end: child.end,
            start: child.start,
            value: nonzeroParentWitness,
          }));
        }),
      );
      return (
        expression !== fallbackResolutionTooComplex && !isStaticallyInvalidArithmetic(expression)
      );
    });
    if (
      outerExpressionHasValidWitness &&
      hasFallbackIndependentClampBound(
        frame,
        value,
        range,
        0,
        'negative',
        budget,
        parenthesisPairs,
        true,
      ) &&
      hasFallbackIndependentClampBound(
        frame,
        value,
        range,
        2,
        'magic',
        budget,
        parenthesisPairs,
        true,
      )
    )
      return [];
  }
  if (analyzedHypotParents.some((parent) => parent.compatibleWitnesses.length === 0))
    return [
      {
        ...candidate,
        hasRuntimeSibling: true,
        resolvedFallback: fallbackResolutionTooComplex,
        resolvedClassification: 'too-complex',
      },
    ];

  const validOuterExpression = resolveFrameExpressionWithRangeReplacements(
    frame,
    value,
    range,
    budget,
    analyzedHypotParents.map((parent) => ({
      end: parent.functionRange.end,
      start: parent.functionRange.start,
      value: parent.compatibleWitnesses[0],
    })),
  );
  if (validOuterExpression === fallbackResolutionTooComplex)
    return [
      {
        ...candidate,
        hasRuntimeSibling: true,
        resolvedFallback: fallbackResolutionTooComplex,
        resolvedClassification: 'too-complex',
      },
    ];
  if (isStaticallyInvalidArithmetic(validOuterExpression)) return [];
  if (liveHypotParents.length > 1) {
    const additiveTermRanges = topLevelAdditiveTermRanges(value, range, parenthesisPairs);
    if (additiveTermRanges !== undefined) {
      const additiveTermExpressions = [];
      let parentIndex = 0;
      for (const termRange of additiveTermRanges) {
        const termParents = [];
        while (
          parentIndex < analyzedHypotParents.length &&
          analyzedHypotParents[parentIndex].functionRange.start < termRange.end
        ) {
          const parent = analyzedHypotParents[parentIndex];
          if (
            parent.functionRange.start >= termRange.start &&
            parent.functionRange.end <= termRange.end
          )
            termParents.push(parent);
          parentIndex += 1;
        }
        const termExpression = resolveFrameExpressionWithRangeReplacements(
          frame,
          value,
          termRange,
          budget,
          termParents.map((parent) => ({
            end: parent.functionRange.end,
            start: parent.functionRange.start,
            value: parent.compatibleWitnesses[0],
          })),
        );
        if (termExpression === fallbackResolutionTooComplex)
          return [
            {
              ...candidate,
              hasRuntimeSibling: true,
              resolvedFallback: fallbackResolutionTooComplex,
              resolvedClassification: 'too-complex',
            },
          ];
        additiveTermExpressions.push(termExpression);
      }
      if (!haveCompatibleStaticProgressTypes(additiveTermExpressions)) return [];
    }
  }
  if (liveHypotParents.length > 1)
    return [
      {
        ...candidate,
        hasRuntimeSibling: true,
        resolvedFallback: fallbackResolutionTooComplex,
        resolvedClassification: 'too-complex',
      },
    ];

  const [liveHypotParent] = liveHypotParents;

  const classifications = new Set();
  let hasValidOuterWitness = false;
  for (const witness of liveHypotParent.compatibleWitnesses) {
    for (const endpointWitness of [witness, `calc(infinity * 1${witness.slice(1)})`]) {
      const expression = resolveFrameExpressionWithRangeReplacements(frame, value, range, budget, [
        ...eliminatedHypotParents.map((parent) => ({
          end: parent.functionRange.end,
          start: parent.functionRange.start,
          value: parent.compatibleWitnesses[0],
        })),
        ...liveHypotParent.children.map((child) => ({
          end: child.end,
          start: child.start,
          value: endpointWitness,
        })),
      ]);
      if (expression === fallbackResolutionTooComplex)
        return [
          {
            ...candidate,
            resolvedFallback: fallbackResolutionTooComplex,
            resolvedClassification: 'too-complex',
            hasRuntimeSibling: true,
          },
        ];
      if (isStaticallyInvalidArithmetic(expression)) continue;
      hasValidOuterWitness = true;
      const analysis = analyzeFrameExpression(frame, expression, budget);
      if (analysis.classification === 'too-complex')
        return [
          {
            ...candidate,
            resolvedFallback: fallbackResolutionTooComplex,
            resolvedClassification: 'too-complex',
          },
        ];
      if (analysis.classification === 'negative' || analysis.classification === 'magic')
        classifications.add(analysis.classification);
      else if (analysis.classification === 'unresolved') classifications.add('too-complex');
      else if (analysis.resultType === 'number') {
        const minimumValue = evaluateStaticLayerNumber(expression);
        if (
          endpointWitness === witness &&
          minimumValue !== undefined &&
          minimumValue >= 0 &&
          minimumValue < 9999.5
        )
          classifications.add('too-complex');
      } else classifications.add('too-complex');
    }
  }
  if (!hasValidOuterWitness) return [];
  return [...classifications].map((resolvedClassification) => ({
    ...candidate,
    hasRuntimeSibling: true,
    ...(resolvedClassification === 'too-complex'
      ? { resolvedFallback: fallbackResolutionTooComplex }
      : {}),
    resolvedClassification,
  }));
}

function unresolvedRuntimeRangeCandidates(
  frame,
  value,
  range,
  candidate,
  budget,
  parenthesisPairs,
  suppressedRuntimeFunctionRanges,
  selectableChildren,
) {
  const zeroProductRange = { ...range, frame };
  const liveFunctionParents = new Set();
  for (const child of frame.children) {
    if (
      (child.resolvedFallback !== null && !child.definedPathCanBeNumber) ||
      !selectableChildren.has(child)
    )
      continue;
    const functionParent = childFunctionParent(child, 'runtimeRangeParent', range);
    if (functionParent === undefined) continue;
    if (childIsMultipliedByStaticZero(value, zeroProductRange, child, budget) === true) continue;
    if (
      suppressedRuntimeFunctionRanges.some(
        (suppressedRange) =>
          functionParent.functionStart >= suppressedRange.start &&
          functionParent.end <= suppressedRange.end,
      )
    )
      continue;
    const functionRange = { start: functionParent.functionStart, end: functionParent.end };
    const parsedArguments = fallbackIndependentStaticArguments(
      frame,
      value,
      functionRange,
      functionParent.functionName,
      parenthesisPairs,
    );
    if (
      !unresolvedRuntimeFunctionHasValidArity(
        functionParent.functionName,
        parsedArguments?.argumentCount,
      )
    )
      continue;
    const numberOnlyArgumentRanges = numberOnlyRuntimeArgumentRanges(
      functionParent.functionName,
      parsedArguments,
      value,
    );
    if (numberOnlyArgumentRanges === undefined) continue;
    if (functionParent.functionName === 'round' && numberOnlyArgumentRanges.length === 0) continue;
    if (
      !runtimeFunctionStaticArgumentsAreValid(
        functionParent.functionName,
        parsedArguments,
        numberOnlyArgumentRanges,
      )
    )
      continue;
    const hasUnavoidablyNonNumberArgument = numberOnlyArgumentRanges.some((argumentRange) =>
      unresolvedFunctionArgumentIsUnavoidablyNonNumber(
        frame,
        value,
        argumentRange,
        parenthesisPairs,
      ),
    );
    if (hasUnavoidablyNonNumberArgument && functionParent.functionName !== 'random') {
      if (
        !steppedValueFunctionNames.has(functionParent.functionName) ||
        !steppedValueFunctionHasValidTypedOuterWitness(
          frame,
          value,
          range,
          functionRange,
          parsedArguments,
          numberOnlyArgumentRanges,
          budget,
        )
      )
        continue;
    }
    const logValueArgument = parsedArguments.argumentRanges[0];
    const definedPathCanChangeLogValue =
      functionParent.functionName === 'log' &&
      child.definedPathCanBeNumber &&
      logValueArgument !== undefined &&
      child.start < logValueArgument.end &&
      child.end > logValueArgument.start;
    if (
      functionParent.functionName === 'log' &&
      !definedPathCanChangeLogValue &&
      logHasFixedZeroResult(parsedArguments.staticArguments)
    ) {
      const fixedZeroExpression = resolveFrameExpressionWithRangeReplacements(
        frame,
        value,
        range,
        budget,
        [{ start: functionRange.start, end: functionRange.end, value: '0' }],
      );
      if (
        fixedZeroExpression !== fallbackResolutionTooComplex &&
        analyzeFrameExpression(frame, fixedZeroExpression, budget).classification === 'safe'
      )
        continue;
    }
    const staticModulusDivisor =
      functionParent.functionName === 'mod'
        ? parsedArguments.staticArguments.find((argument) => argument.index === 1)
        : undefined;
    const functionIsKnownNonnegative =
      functionParent.functionName === 'exp' ||
      functionParent.functionName === 'sqrt' ||
      (staticModulusDivisor !== undefined &&
        staticValueHasPositiveScalarOrTypedMagnitude(staticModulusDivisor.value));
    if (
      functionIsKnownNonnegative &&
      unresolvedNonnegativeFunctionIsSafelyCapped(
        frame,
        value,
        range,
        functionParent,
        functionRange,
        budget,
        parenthesisPairs,
      )
    )
      continue;
    liveFunctionParents.add(functionParent);
  }
  for (const functionParent of liveFunctionParents) {
    const elimination = functionParentIsMultipliedByStaticZero(
      value,
      zeroProductRange,
      functionParent,
      budget,
    );
    if (elimination === true) continue;
    return [
      {
        ...candidate,
        hasRuntimeSibling: true,
        resolvedFallback: fallbackResolutionTooComplex,
        resolvedClassification: 'too-complex',
      },
    ];
  }
  return [];
}

function randomItemArgumentRanges(value, group, parenthesisPairs) {
  const argumentRanges = [];
  let argumentStart = group.openIndex + 1;
  let braceDepth = 0;
  for (let index = argumentStart; index < group.end - 1; index += 1) {
    if (value[index] === '"' || value[index] === "'") index = quotedStringEnd(value, index);
    else {
      const urlTokenEnd = unquotedUrlTokenEnd(value, index);
      if (urlTokenEnd !== undefined) index = urlTokenEnd;
      else if (value[index] === '(') {
        const closeIndex = parenthesisPairs.get(index);
        if (closeIndex === undefined || closeIndex >= group.end) return undefined;
        index = closeIndex;
      } else if (value[index] === '{') braceDepth += 1;
      else if (value[index] === '}') {
        if (braceDepth === 0) return undefined;
        braceDepth -= 1;
      } else if (value[index] === ';') return undefined;
      else if (value[index] === ',' && braceDepth === 0) {
        argumentRanges.push(trimCssTriviaRange(value, argumentStart, index));
        argumentStart = index + 1;
      }
    }
  }
  if (braceDepth !== 0) return undefined;
  argumentRanges.push(trimCssTriviaRange(value, argumentStart, group.end - 1));
  return argumentRanges;
}

function randomItemGroupOutputOptions(value, group, parenthesisPairs) {
  const argumentRanges = randomItemArgumentRanges(value, group, parenthesisPairs);
  if (
    argumentRanges === undefined ||
    argumentRanges.length < 2 ||
    !randomKeyIsStructurallyValid(value, argumentRanges[0])
  )
    return undefined;
  const values = argumentRanges.slice(1).map((argumentRange) => {
    if (value[argumentRange.start] === '{' && value[argumentRange.end - 1] === '}')
      return value.slice(argumentRange.start + 1, argumentRange.end - 1);
    return value.slice(argumentRange.start, argumentRange.end);
  });
  return { continuous: false, values };
}

function randomGroupOutputOptions(frame, value, group, budget, parenthesisPairs) {
  if (group.functionName === 'random-item')
    return randomItemGroupOutputOptions(value, group, parenthesisPairs);
  const functionRange = { start: group.functionStart, end: group.end };
  const parsedArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    functionRange,
    'random',
    parenthesisPairs,
  );
  if (parsedArguments === undefined) return undefined;
  const numericArgumentRanges = randomNumericArgumentRanges(value, parsedArguments);
  if (
    numericArgumentRanges === undefined ||
    !runtimeFunctionStaticArgumentsAreValid('random', parsedArguments, numericArgumentRanges)
  )
    return undefined;

  const numericArgumentStarts = new Set(
    numericArgumentRanges.map((argumentRange) => argumentRange.start),
  );
  const staticNumericArguments = parsedArguments.staticArguments.filter((argument) =>
    numericArgumentStarts.has(argument.range.start),
  );
  if (staticNumericArguments.length !== numericArgumentRanges.length) return { runtime: true };
  const argumentValues = numericArgumentRanges.map(
    (argumentRange) =>
      staticNumericArguments.find((argument) => argument.range.start === argumentRange.start).value,
  );
  const fixedBaseValue = fixedRandomBaseValue(value, parsedArguments);
  let numericValues = argumentValues.map((argument) => evaluateStaticLayerNumber(argument));
  if (
    numericValues.some((numericValue) => numericValue === undefined) &&
    argumentValues.every(
      (argumentValue) => analyzeStaticLayerValue(argumentValue).resultType === 'non-number',
    )
  ) {
    const typedWitness = typedDivisorWitnessValues.find((witness) =>
      argumentValues.every(
        (argumentValue) =>
          evaluateStaticLayerNumber(`calc((${argumentValue}) / (${witness}))`) !== undefined,
      ),
    );
    if (typedWitness !== undefined)
      numericValues = argumentValues.map((argumentValue) =>
        evaluateStaticLayerNumber(`calc((${argumentValue}) / (${typedWitness}))`),
      );
  }
  if (numericValues.some((numericValue) => numericValue === undefined)) {
    if (
      argumentValues.length === 2 &&
      argumentValues.every(
        (argumentValue) => analyzeStaticLayerValue(argumentValue).resultType === 'non-number',
      )
    ) {
      if (fixedBaseValue === 0) return { continuous: false, values: [argumentValues[0]] };
      if (fixedBaseValue !== undefined)
        return {
          continuous: false,
          values: [
            `calc((${argumentValues[0]}) + ${fixedBaseValue} * (max((${argumentValues[0]}), (${argumentValues[1]})) - (${argumentValues[0]})))`,
          ],
        };
      return { continuous: true, values: argumentValues };
    }
    return undefined;
  }
  if (numericValues.some((numericValue) => Number.isNaN(numericValue))) return undefined;

  const [minimumValue, writtenMaximumValue, stepValue] = numericValues;
  const [minimumExpression, writtenMaximumExpression, stepExpression] = argumentValues;
  if (!Number.isFinite(minimumValue)) return { continuous: false, values: [minimumExpression] };
  if (!Number.isFinite(writtenMaximumValue - minimumValue)) return undefined;
  const maximumValue = Math.max(minimumValue, writtenMaximumValue);
  const maximumExpression =
    maximumValue === minimumValue ? minimumExpression : writtenMaximumExpression;
  if (maximumValue === minimumValue) return { continuous: false, values: [minimumExpression] };
  if (stepValue === undefined || stepValue <= 0) {
    if (fixedBaseValue === 0) return { continuous: false, values: [minimumExpression] };
    if (fixedBaseValue !== undefined)
      return {
        continuous: false,
        values: [
          `calc((${minimumExpression}) + ${fixedBaseValue} * ((${maximumExpression}) - (${minimumExpression})))`,
        ],
      };
    return { continuous: true, values: [minimumExpression, maximumExpression] };
  }
  if (!Number.isFinite(stepValue)) return { continuous: false, values: [minimumExpression] };

  const stepCount = Math.floor((maximumValue - minimumValue) / stepValue);
  if (!Number.isSafeInteger(stepCount) || stepCount > 128) return fallbackResolutionTooComplex;
  if (fixedBaseValue !== undefined) {
    const stepIndex = Math.floor(fixedBaseValue * (stepCount + 1));
    const expression =
      stepIndex === 0
        ? minimumExpression
        : `calc((${minimumExpression}) + (${stepExpression}) * ${stepIndex})`;
    if (!consumeResolutionWork(budget, expression.length)) return fallbackResolutionTooComplex;
    return { continuous: false, values: [expression] };
  }
  const values = [];
  for (let stepIndex = 0; stepIndex <= stepCount; stepIndex += 1) {
    const expression =
      stepIndex === 0
        ? minimumExpression
        : `calc((${minimumExpression}) + (${stepExpression}) * ${stepIndex})`;
    if (!consumeResolutionWork(budget, expression.length)) return fallbackResolutionTooComplex;
    values.push(expression);
  }
  return { continuous: false, values };
}

function randomGroupCorrelationKey(frame, value, group, parenthesisPairs) {
  let keyRange;
  if (group.functionName === 'random-item') {
    keyRange = randomItemArgumentRanges(value, group, parenthesisPairs)?.[0];
  } else {
    const parsedArguments = fallbackIndependentStaticArguments(
      frame,
      value,
      { start: group.functionStart, end: group.end },
      'random',
      parenthesisPairs,
    );
    if (parsedArguments === undefined) return undefined;
    const numericArgumentRanges = randomNumericArgumentRanges(value, parsedArguments);
    if (
      numericArgumentRanges === undefined ||
      numericArgumentRanges.length === parsedArguments.argumentCount
    )
      return undefined;
    keyRange = parsedArguments.argumentRanges[0];
  }
  if (keyRange === undefined) return undefined;

  const tokens = value
    .slice(keyRange.start, keyRange.end)
    .replaceAll(cssCommentMaskCharacter, ' ')
    .trim()
    .split(/\s+/);
  const lowerTokens = tokens.map((token) => token.toLowerCase());
  if (
    (lowerTokens.length === 1 && lowerTokens[0] === 'auto') ||
    lowerTokens[0] === 'fixed' ||
    lowerTokens.includes('property-index-scoped')
  )
    return undefined;
  return tokens
    .map((token) => {
      const lowerToken = token.toLowerCase();
      return ['element-scoped', 'property-scoped'].includes(lowerToken) ? lowerToken : token;
    })
    .sort()
    .join(' ');
}

function randomRangeCandidates(frame, value, range, candidate, budget, parenthesisPairs) {
  const groups = frame.randomGroups.filter(
    (group) =>
      group.end !== undefined &&
      group.functionStart >= range.start &&
      group.end <= range.end &&
      group.enclosingRandomParent === undefined,
  );
  if (groups.length === 0) return [];

  const analyzedGroups = [];
  let hasContinuousRange = false;
  for (const group of groups) {
    const options = randomGroupOutputOptions(frame, value, group, budget, parenthesisPairs);
    if (options === undefined || options.runtime === true) continue;
    if (options === fallbackResolutionTooComplex)
      return [
        {
          ...candidate,
          resolvedFallback: fallbackResolutionTooComplex,
          resolvedClassification: 'too-complex',
          hasRuntimeSibling: true,
        },
      ];
    hasContinuousRange ||= options.continuous;
    analyzedGroups.push({
      correlationKey: randomGroupCorrelationKey(frame, value, group, parenthesisPairs),
      group,
      options,
    });
  }
  if (analyzedGroups.length === 0) return [];

  const selectionGroups = [];
  const correlatedSelectionGroups = new Map();
  for (const analyzedGroup of analyzedGroups) {
    const correlationGroupKey =
      analyzedGroup.correlationKey === undefined
        ? undefined
        : `${analyzedGroup.correlationKey}\u0000${analyzedGroup.options.values.length}`;
    let selectionGroup = correlatedSelectionGroups.get(correlationGroupKey);
    if (correlationGroupKey === undefined || selectionGroup === undefined) {
      selectionGroup = { groups: [], optionCount: analyzedGroup.options.values.length };
      selectionGroups.push(selectionGroup);
      if (correlationGroupKey !== undefined)
        correlatedSelectionGroups.set(correlationGroupKey, selectionGroup);
    }
    selectionGroup.groups.push(analyzedGroup);
  }

  if (
    selectionGroups.some(
      (selectionGroup) =>
        selectionGroup.groups.length > 1 &&
        selectionGroup.groups.some(({ options }) => options.continuous),
    )
  ) {
    const randomRanges = [];
    const randomRangeGroupIndexes = [];
    for (let groupIndex = 0; groupIndex < selectionGroups.length; groupIndex += 1) {
      for (const { group } of selectionGroups[groupIndex].groups) {
        randomRanges.push({ start: group.functionStart, end: group.end });
        randomRangeGroupIndexes.push(groupIndex);
      }
    }
    if (
      !progressExpressionIsMultilinear(
        value,
        range,
        randomRanges,
        randomRangeGroupIndexes,
        frame.children,
        parenthesisPairs,
      )
    )
      return [
        {
          ...candidate,
          resolvedFallback: fallbackResolutionTooComplex,
          resolvedClassification: 'too-complex',
          hasRuntimeSibling: true,
        },
      ];
  }

  let combinationCount = 1;
  for (const selectionGroup of selectionGroups) {
    combinationCount *= selectionGroup.optionCount;
    if (!Number.isSafeInteger(combinationCount) || combinationCount > 256)
      return [
        {
          ...candidate,
          resolvedFallback: fallbackResolutionTooComplex,
          resolvedClassification: 'too-complex',
          hasRuntimeSibling: true,
        },
      ];
  }

  const classifications = new Set();
  let minimum = Infinity;
  let maximum = -Infinity;
  let numericResultCount = 0;
  for (let combination = 0; combination < combinationCount; combination += 1) {
    let optionStride = 1;
    const replacements = selectionGroups.flatMap((selectionGroup) => {
      const optionIndex = Math.floor(combination / optionStride) % selectionGroup.optionCount;
      optionStride *= selectionGroup.optionCount;
      return selectionGroup.groups.map(({ group, options }) => ({
        start: group.functionStart,
        end: group.end,
        value: options.values[optionIndex],
      }));
    });
    const expression = resolveFrameExpressionWithRangeReplacements(
      frame,
      value,
      range,
      budget,
      replacements,
    );
    if (expression === fallbackResolutionTooComplex)
      return [
        {
          ...candidate,
          resolvedFallback: fallbackResolutionTooComplex,
          resolvedClassification: 'too-complex',
          hasRuntimeSibling: true,
        },
      ];
    const analysis = analyzeFrameExpression(frame, expression, budget);
    if (analysis.classification === 'negative' || analysis.classification === 'magic')
      classifications.add(analysis.classification);
    if (analysis.resultType !== 'number' || isStaticallyInvalidArithmetic(expression)) continue;
    const numericValue = evaluateStaticLayerNumber(expression);
    if (numericValue === undefined || Number.isNaN(numericValue)) continue;
    numericResultCount += 1;
    minimum = Math.min(minimum, numericValue);
    maximum = Math.max(maximum, numericValue);
  }
  if (hasContinuousRange && numericResultCount > 0) {
    if (minimum < 0) classifications.add('negative');
    if (minimum <= 9999 && maximum >= 9999) classifications.add('magic');
  }
  return [...classifications].map((resolvedClassification) => ({
    ...candidate,
    resolvedClassification,
    hasRuntimeSibling: true,
  }));
}

function treeCountingRangeCandidates(frame, value, range, candidate, budget, parenthesisPairs) {
  const zeroProductRange = { ...range, frame };
  for (const group of frame.treeCountingGroups) {
    if (
      group.end === undefined ||
      group.functionStart < range.start ||
      group.end > range.end ||
      trimCssTriviaRange(value, group.openIndex + 1, group.end - 1).start !==
        trimCssTriviaRange(value, group.openIndex + 1, group.end - 1).end ||
      !childIsInSelectableConditionalBranch(
        { start: group.functionStart, end: group.end, conditionalParent: group.conditionalParent },
        value,
        parenthesisPairs,
        range,
      ) ||
      (group.invalidFunctionParent?.end !== undefined &&
        group.invalidFunctionParent !== group &&
        group.invalidFunctionParent.functionStart >= range.start &&
        group.invalidFunctionParent.end <= range.end)
    )
      continue;
    const elimination = functionParentIsMultipliedByStaticZero(
      value,
      zeroProductRange,
      group,
      budget,
    );
    if (elimination === true) continue;
    return [
      {
        ...candidate,
        resolvedFallback: fallbackResolutionTooComplex,
        resolvedClassification: 'too-complex',
        hasRuntimeSibling: true,
      },
    ];
  }
  return [];
}

function definedSubstitutionPathCandidates(
  frame,
  value,
  range,
  candidate,
  budget,
  parenthesisPairs,
  selectableChildren,
) {
  const candidates = [];
  const expressionRange = unwrapStaticContainer(value, range, parenthesisPairs);
  const childGroups = new Map();
  for (const child of frame.children) {
    if (!child.definedPathCanBeNumber || !selectableChildren.has(child)) continue;
    const key = substitutionDefinedPathIdentity(child, value) ?? `${child.start}:${child.end}`;
    const group = childGroups.get(key);
    if (group === undefined) childGroups.set(key, [child]);
    else group.push(child);
  }
  for (const correlatedChildren of childGroups.values()) {
    if (
      correlatedChildren.length === 1 &&
      correlatedChildren[0].start === expressionRange.start &&
      correlatedChildren[0].end === expressionRange.end
    )
      continue;
    let usesOnlyCalculationContainers = true;
    for (const child of correlatedChildren) {
      let parent = child.parenthesisParent;
      while (
        parent?.type === 'group' &&
        parent.end !== undefined &&
        parent.functionStart >= range.start &&
        parent.end <= range.end
      ) {
        if (
          !parent.isGroupingParenthesis &&
          parent.functionName !== 'calc' &&
          parent.functionName !== '-webkit-calc'
        ) {
          usesOnlyCalculationContainers = false;
          break;
        }
        parent = parent.parenthesisParent;
      }
      if (!usesOnlyCalculationContainers) break;
    }
    if (!usesOnlyCalculationContainers) continue;
    const correlatedChildSet = new Set(correlatedChildren);
    const resolvedSiblings = frame.children.filter(
      (sibling) => !correlatedChildSet.has(sibling) && typeof sibling.resolvedFallback === 'string',
    );
    if (resolvedSiblings.length !== frame.children.length - correlatedChildren.length) continue;
    const childRanges = correlatedChildren.map((child) => ({ start: child.start, end: child.end }));
    if (
      !progressExpressionIsMultilinear(
        value,
        range,
        childRanges,
        childRanges.map(() => 0),
        resolvedSiblings,
        parenthesisPairs,
      )
    )
      continue;
    const endpointExpressions = [];
    for (const witness of ['0', '1']) {
      const expression = resolveFrameExpressionWithRangeReplacements(
        frame,
        value,
        range,
        budget,
        correlatedChildren.map((child) => ({
          start: child.start,
          end: child.end,
          value: witness,
        })),
      );
      if (expression === fallbackResolutionTooComplex)
        return [
          {
            ...candidate,
            resolvedFallback: fallbackResolutionTooComplex,
            resolvedClassification: 'too-complex',
          },
        ];
      const analysis = analyzeFrameExpression(frame, expression, budget);
      if (analysis.resultType !== 'number' || isStaticallyInvalidArithmetic(expression)) {
        endpointExpressions.length = 0;
        break;
      }
      endpointExpressions.push(expression);
    }
    if (endpointExpressions.length !== 2 || haveEqualStaticArithmeticValues(endpointExpressions))
      continue;
    const [child] = correlatedChildren;
    const definedPathCandidate = {
      fallbackIndex: child.start,
      rawFallback: value.slice(child.start, child.end),
      resolvedFallback: fallbackResolutionTooComplex,
      hasRuntimeSibling: true,
    };
    candidates.push(
      { ...definedPathCandidate, resolvedClassification: 'negative' },
      { ...definedPathCandidate, resolvedClassification: 'magic' },
    );
  }
  return candidates;
}

function correlatedVarChildren(frame, value, selectableChildren) {
  const groups = new Map();
  for (const child of frame.children) {
    if (
      child.functionName !== 'var' ||
      !child.definedPathCanBeNumber ||
      !selectableChildren.has(child)
    )
      continue;
    const identity = substitutionDefinedPathIdentity(child, value);
    const group = groups.get(identity);
    if (group === undefined) groups.set(identity, [child]);
    else group.push(child);
  }
  return new Set([...groups.values()].filter((group) => group.length > 1).flat());
}

function unresolvedRuntimeFunctionHasValidArity(functionName, argumentCount) {
  const validArities = unresolvedRuntimeFunctionArities.get(functionName);
  return Array.isArray(validArities)
    ? validArities.includes(argumentCount)
    : validArities === argumentCount;
}

function logStaticArgumentsCanReachValidResult(staticArguments) {
  for (const argument of staticArguments) {
    const value = evaluateStaticLayerNumber(argument.value);
    if (value === undefined) continue;
    if (
      Number.isNaN(value) ||
      (argument.index === 0 && value < 0) ||
      (argument.index === 1 && (value < 0 || value === 1))
    )
      return false;
  }
  return true;
}

function logHasFixedZeroResult(staticArguments) {
  const valueArgument = staticArguments.find((argument) => argument.index === 0);
  return valueArgument !== undefined && evaluateStaticLayerNumber(valueArgument.value) === 1;
}

function randomKeyIsStructurallyValid(value, range) {
  const key = value
    .slice(range.start, range.end)
    .replaceAll(cssCommentMaskCharacter, ' ')
    .trim()
    .toLowerCase();
  if (key === 'auto') return true;
  const fixedMatch = /^fixed\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)$/i.exec(key);
  if (fixedMatch) {
    const fixedValue = Number(fixedMatch[1]);
    return Number.isFinite(fixedValue) && fixedValue >= 0 && fixedValue <= 1;
  }

  const tokens = key.split(/\s+/);
  let dashedIdentifierCount = 0;
  let elementScopeCount = 0;
  let propertyScopeCount = 0;
  for (const token of tokens) {
    if (token.startsWith('--') && cssIdentifierTokenEnd(token, 0) === token.length)
      dashedIdentifierCount += 1;
    else if (token === 'element-scoped') elementScopeCount += 1;
    else if (
      token === 'property-scoped' ||
      token === 'property-index-scoped' ||
      (token.startsWith('ua-') && cssIdentifierTokenEnd(token, 0) === token.length)
    )
      propertyScopeCount += 1;
    else return false;
  }
  return (
    tokens.length > 0 &&
    dashedIdentifierCount <= 1 &&
    elementScopeCount <= 1 &&
    propertyScopeCount <= 1
  );
}

function fixedRandomBaseValue(value, parsedArguments) {
  if (parsedArguments.argumentCount < 3) return undefined;
  const key = value
    .slice(parsedArguments.argumentRanges[0].start, parsedArguments.argumentRanges[0].end)
    .replaceAll(cssCommentMaskCharacter, ' ')
    .trim();
  const fixedMatch = /^fixed\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)$/i.exec(key);
  if (!fixedMatch) return undefined;
  const fixedValue = Number(fixedMatch[1]);
  if (!Number.isFinite(fixedValue) || fixedValue < 0 || fixedValue > 1) return undefined;
  return fixedValue === 1 ? 1 - Number.EPSILON / 2 : fixedValue;
}

function randomNumericArgumentRanges(value, parsedArguments) {
  if (parsedArguments.argumentCount === 2) return parsedArguments.argumentRanges;
  const hasKey = randomKeyIsStructurallyValid(value, parsedArguments.argumentRanges[0]);
  if (parsedArguments.argumentCount === 3)
    return hasKey ? parsedArguments.argumentRanges.slice(1) : parsedArguments.argumentRanges;
  if (parsedArguments.argumentCount === 4 && hasKey) return parsedArguments.argumentRanges.slice(1);
  return undefined;
}

function numberOnlyRuntimeArgumentRanges(functionName, parsedArguments, value) {
  if (functionName === 'exp' || functionName === 'sqrt')
    return parsedArguments.argumentRanges.slice(0, 1);
  if (['log', 'mod', 'pow', 'rem'].includes(functionName)) return parsedArguments.argumentRanges;
  if (functionName === 'random') return randomNumericArgumentRanges(value, parsedArguments);
  if (functionName === 'round') {
    const firstArgument = value
      .slice(parsedArguments.argumentRanges[0].start, parsedArguments.argumentRanges[0].end)
      .replaceAll(cssCommentMaskCharacter, ' ')
      .trim()
      .toLowerCase();
    if (firstArgument === 'line-width') return [];
    const hasStrategy = roundingStrategyNames.has(firstArgument);
    const validArgumentCount = hasStrategy
      ? parsedArguments.argumentCount === 2 || parsedArguments.argumentCount === 3
      : parsedArguments.argumentCount === 1 || parsedArguments.argumentCount === 2;
    if (!validArgumentCount) return undefined;
    return hasStrategy ? parsedArguments.argumentRanges.slice(1) : parsedArguments.argumentRanges;
  }
  return [];
}

function steppedValueStaticIntervalIsValid(functionName, parsedArguments, numberArgumentRanges) {
  let intervalRange;
  if (functionName === 'mod' || functionName === 'rem')
    intervalRange = parsedArguments.argumentRanges[1];
  else if (functionName === 'round' && numberArgumentRanges.length === 2)
    intervalRange = numberArgumentRanges[1];
  if (intervalRange === undefined) return true;
  const staticInterval = parsedArguments.staticArguments.find(
    (argument) => argument.range.start === intervalRange.start,
  );
  if (staticInterval === undefined) return true;
  if (analyzeStaticLayerValue(staticInterval.value).resultType === 'number')
    return !isStaticallyZero(staticInterval.value);
  return !typedDivisorWitnessValues.some((witness) =>
    isStaticallyZero(`calc((${staticInterval.value}) / (${witness}))`),
  );
}

function modOrRemStaticDividendIsValid(functionName, parsedArguments) {
  if (functionName !== 'mod' && functionName !== 'rem') return true;
  const staticDividend = parsedArguments.staticArguments.find((argument) => argument.index === 0);
  if (staticDividend === undefined) return true;
  const scalarValue = evaluateStaticLayerNumber(staticDividend.value);
  if (scalarValue !== undefined) return Number.isFinite(scalarValue);
  return typedDivisorWitnessValues.some((witness) =>
    Number.isFinite(evaluateStaticLayerNumber(`calc((${staticDividend.value}) / (${witness}))`)),
  );
}

function runtimeFunctionStaticArgumentsAreValid(
  functionName,
  parsedArguments,
  numberArgumentRanges,
) {
  const numberArgumentStarts = new Set(
    numberArgumentRanges.map((argumentRange) => argumentRange.start),
  );
  const staticArgumentsToValidate =
    functionName === 'round'
      ? parsedArguments.staticArguments.filter((argument) =>
          numberArgumentStarts.has(argument.range.start),
        )
      : parsedArguments.staticArguments;
  if (functionName === 'random') {
    const numericArgumentStarts = new Set(
      numberArgumentRanges.map((argumentRange) => argumentRange.start),
    );
    const staticNumericArguments = parsedArguments.staticArguments.filter((argument) =>
      numericArgumentStarts.has(argument.range.start),
    );
    const staticValues = staticNumericArguments.map((argument) => argument.value);
    return (
      staticNumericArguments.every((argument) => {
        const analysis = analyzeStaticLayerValue(argument.value);
        return (
          !isStaticallyInvalidArithmetic(argument.value) &&
          (analysis.resultType === 'number' || analysis.resultType === 'non-number')
        );
      }) &&
      (staticValues.length < 2 || haveCompatibleStaticProgressTypes(staticValues))
    );
  }
  if (steppedValueFunctionNames.has(functionName)) {
    const staticValues = staticArgumentsToValidate.map((argument) => argument.value);
    return (
      modOrRemStaticDividendIsValid(functionName, parsedArguments) &&
      staticValues.every((argument) => {
        const analysis = analyzeStaticLayerValue(argument);
        return (
          !isStaticallyInvalidArithmetic(argument) &&
          (analysis.resultType === 'number' || analysis.resultType === 'non-number')
        );
      }) &&
      (staticValues.length < 2 || haveCompatibleStaticProgressTypes(staticValues)) &&
      steppedValueStaticIntervalIsValid(functionName, parsedArguments, numberArgumentRanges)
    );
  }
  return (
    (functionName !== 'log' ||
      logStaticArgumentsCanReachValidResult(parsedArguments.staticArguments)) &&
    modOrRemStaticDividendIsValid(functionName, parsedArguments) &&
    staticArgumentsToValidate.every(
      (argument) =>
        !isStaticallyInvalidArithmetic(argument.value) &&
        (!['log', 'pow'].includes(functionName) ||
          analyzeStaticLayerValue(argument.value).resultType !== 'non-number') &&
        analyzeStaticLayerValue(argument.value).resultType === 'number',
    ) &&
    steppedValueStaticIntervalIsValid(functionName, parsedArguments, numberArgumentRanges)
  );
}

function childIsInsideProvablyInvalidNumberOnlyFunction(
  child,
  frame,
  value,
  range,
  parenthesisPairs,
  invalidFunctionCache,
  budget,
  invalidTypedSteppedParents,
) {
  let parent = child.parenthesisParent;
  while (
    parent?.type === 'group' &&
    parent.end !== undefined &&
    parent.functionStart >= range.start &&
    parent.end <= range.end
  ) {
    if (
      !['exp', 'log', 'pow', 'random', 'sqrt'].includes(parent.functionName) &&
      !steppedValueFunctionNames.has(parent.functionName)
    ) {
      parent = parent.parenthesisParent;
      continue;
    }
    const cachedResult = invalidFunctionCache.get(parent);
    if (cachedResult === true) return true;
    if (cachedResult === false) {
      parent = parent.parenthesisParent;
      continue;
    }
    const parsedArguments = fallbackIndependentStaticArguments(
      frame,
      value,
      { start: parent.functionStart, end: parent.end },
      parent.functionName,
      parenthesisPairs,
    );
    const numberArgumentRanges =
      parsedArguments !== undefined &&
      unresolvedRuntimeFunctionHasValidArity(parent.functionName, parsedArguments.argumentCount)
        ? numberOnlyRuntimeArgumentRanges(parent.functionName, parsedArguments, value)
        : undefined;
    const hasUnavoidablyNonNumberArgument =
      numberArgumentRanges !== undefined &&
      numberArgumentRanges.some((argumentRange) =>
        unresolvedFunctionArgumentIsUnavoidablyNonNumber(
          frame,
          value,
          argumentRange,
          parenthesisPairs,
        ),
      );
    const typedSteppedFunctionIsInvalid =
      steppedValueFunctionNames.has(parent.functionName) &&
      hasUnavoidablyNonNumberArgument &&
      !steppedValueFunctionHasValidTypedOuterWitness(
        frame,
        value,
        range,
        { start: parent.functionStart, end: parent.end },
        parsedArguments,
        numberArgumentRanges,
        budget,
      );
    if (typedSteppedFunctionIsInvalid) invalidTypedSteppedParents.add(parent);
    const isInvalidNumberOnlyFunction =
      parsedArguments !== undefined &&
      unresolvedRuntimeFunctionHasValidArity(parent.functionName, parsedArguments.argumentCount) &&
      numberArgumentRanges !== undefined &&
      ((parent.functionName === 'round' && numberArgumentRanges.length === 0) ||
        !runtimeFunctionStaticArgumentsAreValid(
          parent.functionName,
          parsedArguments,
          numberArgumentRanges,
        ) ||
        (parent.functionName !== 'random' &&
          !steppedValueFunctionNames.has(parent.functionName) &&
          hasUnavoidablyNonNumberArgument) ||
        typedSteppedFunctionIsInvalid);
    invalidFunctionCache.set(parent, isInvalidNumberOnlyFunction);
    if (isInvalidNumberOnlyFunction) return true;
    parent = parent.parenthesisParent;
  }
  return false;
}

function staticValueHasPositiveScalarOrTypedMagnitude(value) {
  const scalarValue = evaluateStaticLayerNumber(value);
  if (scalarValue !== undefined) return scalarValue > 0;
  return typedDivisorWitnessValues.some(
    (witness) => evaluateStaticLayerNumber(`calc((${value}) / (${witness}))`) > 0,
  );
}

function steppedValueFunctionHasValidTypedOuterWitness(
  frame,
  value,
  range,
  functionRange,
  parsedArguments,
  numberArgumentRanges,
  budget,
) {
  const numberArgumentStarts = new Set(
    numberArgumentRanges.map((argumentRange) => argumentRange.start),
  );
  const staticNumericValues = parsedArguments.staticArguments
    .filter((argument) => numberArgumentStarts.has(argument.range.start))
    .map((argument) => argument.value);
  const firstStaticNumericValue = staticNumericValues[0];
  const witnessValues = [
    ...(firstStaticNumericValue === undefined ? [] : [`calc((${firstStaticNumericValue}) / 2)`]),
    ...typedDivisorWitnessValues,
  ];
  return witnessValues.some((witness) => {
    if (!haveCompatibleStaticProgressTypes([...staticNumericValues, witness])) return false;
    const expression = resolveFrameExpressionWithRangeReplacements(frame, value, range, budget, [
      { start: functionRange.start, end: functionRange.end, value: witness },
    ]);
    return (
      expression !== fallbackResolutionTooComplex &&
      !isStaticallyInvalidArithmetic(expression) &&
      analyzeStaticLayerValue(expression).resultType === 'number'
    );
  });
}

function childHasKnownNonnegativeTypedModPath(
  child,
  frame,
  value,
  range,
  parenthesisPairs,
  budget,
) {
  const functionParent = childFunctionParent(child, 'runtimeRangeParent', range);
  if (functionParent?.functionName !== 'mod') return false;
  const functionRange = { start: functionParent.functionStart, end: functionParent.end };
  const parsedArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    functionRange,
    'mod',
    parenthesisPairs,
  );
  if (parsedArguments?.argumentCount !== 2) return false;
  const numberArgumentRanges = numberOnlyRuntimeArgumentRanges('mod', parsedArguments, value);
  const staticDivisor = parsedArguments.staticArguments.find((argument) => argument.index === 1);
  return (
    numberArgumentRanges !== undefined &&
    staticDivisor !== undefined &&
    staticValueHasPositiveScalarOrTypedMagnitude(staticDivisor.value) &&
    steppedValueFunctionHasValidTypedOuterWitness(
      frame,
      value,
      range,
      functionRange,
      parsedArguments,
      numberArgumentRanges,
      budget,
    )
  );
}

function childHasValidTypedSteppedOuterPath(child, frame, value, range, parenthesisPairs, budget) {
  const functionParent = childFunctionParent(child, 'runtimeRangeParent', range);
  if (!steppedValueFunctionNames.has(functionParent?.functionName)) return false;
  const functionRange = { start: functionParent.functionStart, end: functionParent.end };
  const parsedArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    functionRange,
    functionParent.functionName,
    parenthesisPairs,
  );
  if (
    parsedArguments === undefined ||
    !unresolvedRuntimeFunctionHasValidArity(
      functionParent.functionName,
      parsedArguments.argumentCount,
    )
  )
    return false;
  const numberArgumentRanges = numberOnlyRuntimeArgumentRanges(
    functionParent.functionName,
    parsedArguments,
    value,
  );
  return (
    numberArgumentRanges !== undefined &&
    steppedValueFunctionHasValidTypedOuterWitness(
      frame,
      value,
      range,
      functionRange,
      parsedArguments,
      numberArgumentRanges,
      budget,
    )
  );
}

function unresolvedFunctionArgumentIsUnavoidablyNonNumber(frame, value, range, parenthesisPairs) {
  const pendingRanges = [range];
  let inspectedRangeCount = 0;
  while (pendingRanges.length > 0) {
    if (inspectedRangeCount >= conditionalNestingLimit) return false;
    inspectedRangeCount += 1;
    const currentRange = pendingRanges.pop();
    const firstContainedChild =
      frame.children[firstChildEndingAfter(frame.children, currentRange.start)];
    const containsFallback =
      firstContainedChild !== undefined &&
      firstContainedChild.start < currentRange.end &&
      firstContainedChild.end > currentRange.start;
    if (
      !containsFallback &&
      analyzeStaticLayerValue(value.slice(currentRange.start, currentRange.end)).resultType ===
        'non-number'
    )
      return true;
    const termRanges = topLevelAdditiveTermRanges(value, currentRange, parenthesisPairs);
    if (termRanges !== undefined) {
      let childIndex = firstChildEndingAfter(frame.children, termRanges[0].start);
      for (const termRange of termRanges) {
        while (frame.children[childIndex]?.end <= termRange.start) childIndex += 1;
        const child = frame.children[childIndex];
        if (child?.start < termRange.end && child.end > termRange.start) continue;
        const term = value.slice(termRange.start, termRange.end);
        if (analyzeStaticLayerValue(term).resultType === 'non-number') return true;
      }
    }

    for (const functionName of ['abs', 'clamp', 'hypot', 'max', 'min']) {
      const parsedArguments = fallbackIndependentStaticArguments(
        frame,
        value,
        currentRange,
        functionName,
        parenthesisPairs,
      );
      if (parsedArguments === undefined) continue;
      if (
        parsedArguments.argumentCount < 1 ||
        (functionName === 'clamp' && parsedArguments.argumentCount !== 3) ||
        (functionName === 'abs' && parsedArguments.argumentCount !== 1)
      )
        break;
      if (
        parsedArguments.staticArguments.some(
          (argument) => analyzeStaticLayerValue(argument.value).resultType === 'non-number',
        )
      )
        return true;
      const staticArgumentIndexes = new Set(
        parsedArguments.staticArguments.map((argument) => argument.index),
      );
      for (let index = 0; index < parsedArguments.argumentRanges.length; index += 1) {
        if (!staticArgumentIndexes.has(index))
          pendingRanges.push(parsedArguments.argumentRanges[index]);
      }
      break;
    }
  }
  return false;
}

function unresolvedNonnegativeFunctionIsSafelyCapped(
  frame,
  value,
  range,
  functionParent,
  functionRange,
  budget,
  parenthesisPairs,
) {
  const minimumArguments = fallbackIndependentStaticArguments(
    frame,
    value,
    range,
    'min',
    parenthesisPairs,
  );
  if (
    minimumArguments === undefined ||
    minimumArguments.staticArguments.length !== minimumArguments.argumentCount - 1
  )
    return false;
  const staticArgumentIndexes = new Set(
    minimumArguments.staticArguments.map((argument) => argument.index),
  );
  const dynamicArgumentIndex = minimumArguments.argumentRanges.findIndex(
    (_, argumentIndex) => !staticArgumentIndexes.has(argumentIndex),
  );
  const dynamicArgumentRange = minimumArguments.argumentRanges[dynamicArgumentIndex];
  if (dynamicArgumentRange === undefined) return false;
  let enclosingFunctionParent = functionParent.parenthesisParent;
  while (
    enclosingFunctionParent?.type === 'group' &&
    enclosingFunctionParent.end !== undefined &&
    enclosingFunctionParent.functionStart >= dynamicArgumentRange.start &&
    enclosingFunctionParent.end <= dynamicArgumentRange.end
  ) {
    if (
      !enclosingFunctionParent.isGroupingParenthesis &&
      enclosingFunctionParent.functionName !== 'calc' &&
      enclosingFunctionParent.functionName !== '-webkit-calc'
    )
      return false;
    enclosingFunctionParent = enclosingFunctionParent.parenthesisParent;
  }
  if (
    functionRange.start < dynamicArgumentRange.start ||
    functionRange.end > dynamicArgumentRange.end ||
    frame.children.some(
      (child) =>
        child.start >= dynamicArgumentRange.start &&
        child.end <= dynamicArgumentRange.end &&
        (child.start < functionRange.start || child.end > functionRange.end),
    ) ||
    !progressExpressionIsMultilinear(
      value,
      dynamicArgumentRange,
      [functionRange],
      [0],
      [],
      parenthesisPairs,
    )
  )
    return false;
  if (
    minimumArguments.staticArguments.some(
      (argument) =>
        isStaticallyInvalidArithmetic(argument.value) ||
        analyzeStaticLayerValue(argument.value).resultType === 'non-number',
    )
  )
    return true;
  const expEndpointExpressions = [];
  const expEndpoints = [];
  for (const endpoint of [0, 1]) {
    const endpointExpression = resolveFrameExpressionWithRangeReplacements(
      frame,
      value,
      dynamicArgumentRange,
      budget,
      [{ start: functionRange.start, end: functionRange.end, value: String(endpoint) }],
    );
    if (endpointExpression === fallbackResolutionTooComplex) return false;
    expEndpointExpressions.push(endpointExpression);
    const endpointValue = evaluateStaticLayerNumber(endpointExpression);
    if (endpointValue === undefined || !Number.isFinite(endpointValue)) return false;
    expEndpoints.push(endpointValue);
  }
  const [zeroEndpoint, oneEndpoint] = expEndpoints;
  if (
    zeroEndpoint < 0 ||
    oneEndpoint < zeroEndpoint ||
    (oneEndpoint === zeroEndpoint && !haveEqualStaticArithmeticValues(expEndpointExpressions))
  )
    return false;
  return (
    minimumArguments.staticArguments.every(
      (argument) =>
        classifyStaticLayer(argument.value) === 'safe' && isStaticallyNonnegative(argument.value),
    ) && hasFallbackIndependentSafeBound(frame, value, range, 'min', 'magic', parenthesisPairs)
  );
}

function conditionalReplacementCombinations(replacementGroups, budget, initialCombinations = [[]]) {
  let combinations = initialCombinations;
  for (const replacements of replacementGroups) {
    const combinationCount = combinations.length * replacements.length;
    const combinationWork = combinationCount * ((combinations[0]?.length ?? 0) + 1);
    if (
      !Number.isSafeInteger(combinationCount) ||
      !Number.isSafeInteger(combinationWork) ||
      !consumeResolutionWork(budget, combinationWork)
    )
      return fallbackResolutionTooComplex;
    const nextCombinations = [];
    for (const combination of combinations)
      for (const replacement of replacements) nextCombinations.push([...combination, replacement]);
    combinations = nextCombinations;
  }
  return combinations;
}

function conditionalGroupReplacements(
  frame,
  value,
  group,
  budget,
  parenthesisPairs,
  nestingDepth = 0,
) {
  if (nestingDepth > conditionalNestingLimit) return fallbackResolutionTooComplex;
  const branchRanges = conditionalBranchValueRanges(value, group, parenthesisPairs);
  if (branchRanges === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
  if (branchRanges === undefined) return undefined;

  const replacements = [];
  let nestedGroupIndex = 0;
  for (const branchRange of branchRanges) {
    while (group.conditionalChildren[nestedGroupIndex]?.end <= branchRange.start)
      nestedGroupIndex += 1;
    const nestedGroups = [];
    while (group.conditionalChildren[nestedGroupIndex]?.functionStart < branchRange.end) {
      nestedGroups.push(group.conditionalChildren[nestedGroupIndex]);
      nestedGroupIndex += 1;
    }
    const nestedReplacementGroups = [];
    for (const nestedGroup of nestedGroups) {
      const nestedReplacements = conditionalGroupReplacements(
        frame,
        value,
        nestedGroup,
        budget,
        parenthesisPairs,
        nestingDepth + 1,
      );
      if (nestedReplacements === undefined) return undefined;
      if (nestedReplacements === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
      nestedReplacementGroups.push(nestedReplacements);
    }
    const nestedCombinations = conditionalReplacementCombinations(nestedReplacementGroups, budget);
    if (nestedCombinations === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
    const branchFrame = {
      ...frame,
      children: frame.children.filter(
        (child) => child.start >= branchRange.start && child.end <= branchRange.end,
      ),
    };
    for (const nestedCombination of nestedCombinations) {
      const preserveKnownRuntimeBranch =
        group.functionName === 'first-valid' &&
        firstValidBranchIsKnownRuntimeFunction(value, frame, branchRange, parenthesisPairs);
      const resolvedBranch = preserveKnownRuntimeBranch
        ? value.slice(branchRange.start, branchRange.end)
        : resolveFrameExpressionWithRangeReplacements(
            branchFrame,
            value,
            branchRange,
            budget,
            nestedCombination,
          );
      if (resolvedBranch === fallbackResolutionTooComplex) return fallbackResolutionTooComplex;
      const nestedAnchor = nestedCombination.find(
        (replacement) => replacement.anchorRange.start !== replacement.anchorRange.end,
      )?.anchorRange;
      replacements.push({
        start: group.functionStart,
        end: group.end,
        value: resolvedBranch,
        anchorRange: nestedAnchor ?? branchRange,
      });
    }
  }
  return replacements;
}

function conditionalRangeCandidates(frame, value, range, candidate, budget, parenthesisPairs) {
  const trimmedRange = trimCssTriviaRange(value, range.start, range.end);
  const topLevelGroups = frame.conditionalGroups.filter((group) => {
    if (
      group.functionStart < range.start ||
      group.end > range.end ||
      group.enclosingConditionalParent !== undefined
    )
      return false;
    if (group.functionName !== 'first-valid') return true;
    if (group.functionStart !== trimmedRange.start || group.end !== trimmedRange.end) return false;
    const branchRanges = firstValidBranchValueRanges(value, group, parenthesisPairs);
    return !(
      Array.isArray(branchRanges) &&
      branchRanges.length === 1 &&
      firstValidBranchIsKnownRuntimeFunction(value, frame, branchRanges[0], parenthesisPairs)
    );
  });
  if (topLevelGroups.length === 0) return [];

  let combinations = [[]];
  for (const group of topLevelGroups) {
    const replacements = conditionalGroupReplacements(
      frame,
      value,
      group,
      budget,
      parenthesisPairs,
    );
    if (replacements === undefined) return [];
    if (replacements === fallbackResolutionTooComplex)
      return [
        {
          ...candidate,
          resolvedFallback: fallbackResolutionTooComplex,
          resolvedClassification: 'too-complex',
          hasRuntimeSibling: true,
        },
      ];
    combinations = conditionalReplacementCombinations([replacements], budget, combinations);
    if (combinations === fallbackResolutionTooComplex)
      return [
        {
          ...candidate,
          resolvedFallback: fallbackResolutionTooComplex,
          resolvedClassification: 'too-complex',
          hasRuntimeSibling: true,
        },
      ];
  }

  const candidates = [];
  for (const combination of combinations) {
    const expression = resolveFrameExpressionWithRangeReplacements(
      frame,
      value,
      range,
      budget,
      combination,
    );
    if (expression === fallbackResolutionTooComplex)
      return [
        {
          ...candidate,
          resolvedFallback: fallbackResolutionTooComplex,
          resolvedClassification: 'too-complex',
          hasRuntimeSibling: true,
        },
      ];
    const analysis = analyzeFrameExpression(frame, expression, budget);
    if (analysis.classification !== 'negative' && analysis.classification !== 'magic') continue;
    const anchoredReplacements = combination.filter(
      (replacement) => replacement.anchorRange.start !== replacement.anchorRange.end,
    );
    const replacementsToCheck =
      anchoredReplacements.length <= 32
        ? anchoredReplacements
        : anchoredReplacements.filter(
            (replacement) =>
              analyzeStaticLayerValue(replacement.value).classification === analysis.classification,
          );
    const contributingReplacements = [];
    if (replacementsToCheck.length <= 32) {
      for (const replacementToCheck of replacementsToCheck) {
        let contributes = false;
        for (const witness of ['0', '1']) {
          if (replacementToCheck.value.trim() === witness) continue;
          const neutralizedExpression = resolveFrameExpressionWithRangeReplacements(
            frame,
            value,
            range,
            budget,
            combination.map((replacement) =>
              replacement === replacementToCheck ? { ...replacement, value: witness } : replacement,
            ),
          );
          if (neutralizedExpression === fallbackResolutionTooComplex) continue;
          if (
            analyzeFrameExpression(frame, neutralizedExpression, budget).classification !==
            analysis.classification
          ) {
            contributes = true;
            break;
          }
        }
        if (contributes) contributingReplacements.push(replacementToCheck);
      }
    }
    const anchorRange =
      contributingReplacements.length === 1 ? contributingReplacements[0].anchorRange : undefined;
    candidates.push({
      ...candidate,
      ...(anchorRange === undefined
        ? {}
        : {
            fallbackIndex: anchorRange.start,
            rawFallback: value.slice(anchorRange.start, anchorRange.end),
          }),
      resolvedFallback: expression,
      resolvedClassification: analysis.classification,
      hasRuntimeSibling: true,
    });
  }
  return candidates;
}

function selectedConditionalRuntimeRanges(frame, value, range, parenthesisPairs) {
  const trimmedRange = trimCssTriviaRange(value, range.start, range.end);
  const selectedRanges = [];
  for (const group of frame.conditionalGroups) {
    if (group.functionStart !== trimmedRange.start || group.end !== trimmedRange.end) continue;
    const branchRanges = conditionalBranchValueRanges(value, group, parenthesisPairs);
    if (!Array.isArray(branchRanges)) continue;
    for (const branchRange of branchRanges) {
      if (firstValidBranchIsKnownRuntimeFunction(value, frame, branchRange, parenthesisPairs))
        selectedRanges.push(branchRange);
    }
  }
  return selectedRanges;
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
  const invalidNumberOnlyFunctionCache = new Map();
  const invalidTypedSteppedParents = new Set();
  const selectableChildren = new Set(
    frame.children.filter(
      (child) =>
        childIsInSelectableConditionalBranch(child, value, parenthesisPairs, range) &&
        !childIsInsideProvablyInvalidNumberOnlyFunction(
          child,
          frame,
          value,
          range,
          parenthesisPairs,
          invalidNumberOnlyFunctionCache,
          budget,
          invalidTypedSteppedParents,
        ),
    ),
  );
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
  const allSelectableChildrenHaveValidTypedSteppedOuterPaths =
    selectableChildren.size > 0 &&
    [...selectableChildren].every((child) =>
      childHasValidTypedSteppedOuterPath(child, frame, value, range, parenthesisPairs, budget),
    );
  const hasNonnegativeFloor =
    hasFallbackIndependentSafeBound(frame, value, range, 'max', 'negative', parenthesisPairs) ||
    hasFallbackIndependentClampBound(
      frame,
      value,
      range,
      0,
      'negative',
      budget,
      parenthesisPairs,
      allSelectableChildrenHaveValidTypedSteppedOuterPaths,
    );
  const hasMagicBound =
    hasFallbackIndependentSafeBound(frame, value, range, 'max', 'magic', parenthesisPairs) ||
    hasFallbackIndependentSafeBound(frame, value, range, 'min', 'magic', parenthesisPairs) ||
    hasFallbackIndependentClampBound(
      frame,
      value,
      range,
      2,
      'magic',
      budget,
      parenthesisPairs,
      allSelectableChildrenHaveValidTypedSteppedOuterPaths,
    );
  const allSelectableChildrenHaveKnownNonnegativeTypedModPaths =
    selectableChildren.size > 0 &&
    [...selectableChildren].every((child) =>
      childHasKnownNonnegativeTypedModPath(child, frame, value, range, parenthesisPairs, budget),
    );
  // Every banned classification is eliminated once both independent bounds
  // are proven. Avoid the remaining whole-expression analyses for wide safe
  // clamps because they cannot change that result.
  if (
    (hasNonnegativeFloor || allSelectableChildrenHaveKnownNonnegativeTypedModPaths) &&
    hasMagicBound
  )
    return [];
  if (frame.resolvedClassification === 'too-complex')
    return invalidTypedSteppedParents.size > 0 && selectableChildren.size === 0 ? [] : [candidate];
  const additiveNonNumberSuppression =
    frame.resolvedClassification === 'unresolved'
      ? additiveNonNumberCandidateSuppression(frame, value, range, budget, parenthesisPairs)
      : undefined;
  if (isValidProgressRange(frame, value, range, parenthesisPairs)) return [];
  const trimmedFrameRange = trimCssTriviaRange(value, range.start, range.end);
  const rootHasAdjacentSubstitutionToken =
    frame.type === 'root' &&
    frame.children.length === 1 &&
    ((onlyChild.start === trimmedFrameRange.start && onlyChild.end < trimmedFrameRange.end) ||
      (onlyChild.start > trimmedFrameRange.start && onlyChild.end === trimmedFrameRange.end)) &&
    hasAdjacentFallbackToken(frame, value, range, budget);
  const candidatesAreHiddenByInvalidTokenStream =
    frame.resolvedClassification === 'unresolved' &&
    ((frame.type !== 'root' &&
      (frame.hasInvalidCommaStream === true ||
        hasBareOperatorStream(value, range.start, range.end, budget, frame.mathContext, true) ||
        hasAdjacentFallbackToken(frame, value, range, budget))) ||
      rootHasAdjacentSubstitutionToken);
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
  const correlatedChildren = correlatedVarChildren(frame, value, selectableChildren);
  const uneliminatedChildren = frame.children.filter(
    (child) =>
      child.unprovenBannedCandidates.length > 0 &&
      !correlatedChildren.has(child) &&
      !candidatesAreHiddenByInvalidTokenStream &&
      selectableChildren.has(child) &&
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
  const selectedRuntimeRanges = selectedConditionalRuntimeRanges(
    frame,
    value,
    range,
    parenthesisPairs,
  );
  const selectedProgressRange = selectedRuntimeRanges.find((selectedRange) => {
    const identifierEnd = cssIdentifierTokenEnd(value, selectedRange.start);
    return progressFunctionNames.has(value.slice(selectedRange.start, identifierEnd).toLowerCase());
  });
  const selectedRandomRanges = selectedRuntimeRanges.filter((selectedRange) =>
    /^random(?:-item)?\(/i.test(value.slice(selectedRange.start, selectedRange.start + 12)),
  );
  const progressAnalysis = progressRangeCandidates(
    frame,
    value,
    selectedProgressRange ?? range,
    candidate,
    budget,
    parenthesisPairs,
    selectableChildren,
  );
  const signAnalysis = signRangeCandidates(
    frame,
    value,
    range,
    candidate,
    budget,
    parenthesisPairs,
    zeroQuotientEndpoint?.ranges ?? [],
    selectableChildren,
  );
  const childCandidates = uneliminatedChildren
    .filter(
      (child) =>
        child !== progressAnalysis.suppressedChild && child !== signAnalysis.suppressedChild,
    )
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
  const suppressedRuntimeFunctionRanges = [
    ...(zeroQuotientEndpoint?.ranges ?? []),
    ...signAnalysis.analyzedRanges,
    ...selectedRuntimeRanges,
  ];
  const boundedRuntimeCandidates = [
    ...conditionalRangeCandidates(frame, value, range, candidate, budget, parenthesisPairs),
    ...progressAnalysis.candidates,
    ...signAnalysis.candidates.filter(
      (signCandidate) => !candidateIsSuppressedByZeroQuotient(signCandidate),
    ),
    ...unresolvedExtremaRangeCandidates(
      frame,
      value,
      range,
      candidate,
      budget,
      parenthesisPairs,
      suppressedRuntimeFunctionRanges,
      selectableChildren,
    ),
    ...typedHypotRangeCandidates(
      frame,
      value,
      range,
      candidate,
      budget,
      parenthesisPairs,
      selectableChildren,
    ),
    ...unresolvedRuntimeRangeCandidates(
      frame,
      value,
      range,
      candidate,
      budget,
      parenthesisPairs,
      suppressedRuntimeFunctionRanges,
      selectableChildren,
    ),
    ...definedSubstitutionPathCandidates(
      frame,
      value,
      range,
      candidate,
      budget,
      parenthesisPairs,
      selectableChildren,
    ),
    ...(selectedRandomRanges.length === 0
      ? randomRangeCandidates(frame, value, range, candidate, budget, parenthesisPairs)
      : selectedRandomRanges.flatMap((selectedRandomRange) =>
          randomRangeCandidates(
            frame,
            value,
            selectedRandomRange,
            candidate,
            budget,
            parenthesisPairs,
          ),
        )),
    ...treeCountingRangeCandidates(frame, value, range, candidate, budget, parenthesisPairs),
  ];
  const uneliminatedCandidates = (
    runtimeZeroClassification === 'negative' || runtimeZeroClassification === 'magic'
      ? [
          ...childCandidates,
          ...directArgumentCandidates,
          ...boundedRuntimeCandidates,
          {
            ...candidate,
            resolvedFallback: runtimeZeroFallback,
            resolvedClassification: runtimeZeroClassification,
          },
        ]
      : [...childCandidates, ...directArgumentCandidates, ...boundedRuntimeCandidates]
  ).filter((childCandidate) => !candidateConflictsWithStaticMathArgument(childCandidate));

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
  const rootFrame = {
    type: 'root',
    children: [],
    conditionalGroups: [],
    hasInvalidCommaStream: false,
    progressGroups: [],
    randomGroups: [],
    treeCountingGroups: [],
  };
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
        conditionalGroups: [],
        fallbackParent: nearestFunction,
        consumerRequiresSignedZero: inheritedConsumerContext,
        unprovenBannedCandidates: [],
        resolvedFallback: null,
        resolvedClassification: 'unresolved',
        progressGroups: [],
        randomGroups: [],
        mathContext: parentheses.at(-1)?.mathContext === true,
        invalidFunctionParent: parentheses.at(-1)?.invalidFunctionParent,
        parenthesisParent: parentheses.at(-1),
        extremaParent: parentheses.at(-1)?.extremaParent,
        hypotParent: parentheses.at(-1)?.hypotParent,
        progressParent: parentheses.at(-1)?.progressParent,
        signParent: parentheses.at(-1)?.signParent,
        conditionalParent: parentheses.at(-1)?.conditionalParent,
        runtimeRangeParent: parentheses.at(-1)?.runtimeRangeParent,
        unsupportedProgressRangeParent: parentheses.at(-1)?.unsupportedProgressRangeParent,
        signedZeroSensitiveContext: inheritedContext || isPrecededByDivision(value, index),
        treeCountingGroups: [],
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
        parenthesisParent,
        ...context,
      };
      const randomOwner = fallbackFrames.at(-1) ?? rootFrame;
      const progressOwner = randomOwner;
      const enclosingRandomParent =
        parenthesisParent?.randomOwner === randomOwner ? parenthesisParent.randomParent : undefined;
      group.randomOwner = randomOwner;
      group.enclosingRandomParent = enclosingRandomParent;
      group.randomParent =
        group.functionName === 'random' || group.functionName === 'random-item'
          ? group
          : enclosingRandomParent;
      const isInvalidFunctionBlock =
        !group.isGroupingParenthesis &&
        !mathFunctionNames.has(group.functionName) &&
        !conditionalFunctionNames.has(group.functionName) &&
        !substitutionFunctionNames.has(group.functionName) &&
        !contextualProgressFunctionNames.has(group.functionName) &&
        group.functionName !== 'random-item';
      group.invalidFunctionParent = isInvalidFunctionBlock
        ? group
        : mathFunctionNames.has(group.functionName)
          ? undefined
          : parenthesisParent?.invalidFunctionParent;
      group.progressParent = progressFunctionNames.has(group.functionName)
        ? group
        : parenthesisParent?.progressParent;
      group.signParent = group.functionName === 'sign' ? group : parenthesisParent?.signParent;
      group.extremaParent = extremaFunctionNames.has(group.functionName)
        ? group
        : parenthesisParent?.extremaParent;
      group.hypotParent = hypotFunctionNames.has(group.functionName)
        ? group
        : parenthesisParent?.hypotParent;
      group.runtimeRangeParent = unresolvedRuntimeFunctionArities.has(group.functionName)
        ? group
        : parenthesisParent?.runtimeRangeParent;
      if (conditionalFunctionNames.has(group.functionName)) {
        const conditionalOwner = fallbackFrames.at(-1);
        group.conditionalChildren = [];
        group.conditionalOwner = conditionalOwner ?? rootFrame;
        const inheritedConditionalParent = parenthesisParent?.conditionalParent;
        group.enclosingConditionalParent =
          inheritedConditionalParent?.conditionalOwner === group.conditionalOwner
            ? inheritedConditionalParent
            : undefined;
        group.enclosingConditionalParent?.conditionalChildren.push(group);
        group.conditionalParent = group;
        if (conditionalOwner !== undefined && conditionalOwner.commaIndex !== -1)
          conditionalOwner.conditionalGroups.push(group);
        else if (conditionalOwner === undefined) rootFrame.conditionalGroups.push(group);
      } else group.conditionalParent = parenthesisParent?.conditionalParent;
      if (treeCountingFunctionNames.has(group.functionName)) {
        const treeCountingOwner = fallbackFrames.at(-1) ?? rootFrame;
        treeCountingOwner.treeCountingGroups.push(group);
      }
      if (group.functionName === 'random' || group.functionName === 'random-item') {
        randomOwner.randomGroups.push(group);
      }
      if (contextualProgressFunctionNames.has(group.functionName)) {
        progressOwner.progressGroups.push(group);
      }
      const progressRangeIsUnsupported =
        group.signedZeroSensitiveContext ||
        (!group.isGroupingParenthesis &&
          group.functionName !== 'calc' &&
          group.functionName !== '-webkit-calc' &&
          !progressFunctionNames.has(group.functionName));
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
    frame.definedPathCanBeNumber =
      frame.fallbackParent !== undefined && substitutionDefinedPathCanBeNumber(frame, value);
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

  if (
    rootFrame.children.length > 0 ||
    rootFrame.conditionalGroups.length > 0 ||
    rootFrame.randomGroups.length > 0 ||
    rootFrame.treeCountingGroups.length > 0
  ) {
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
