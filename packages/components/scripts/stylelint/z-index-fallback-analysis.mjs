import {
  analyzeStaticLayerValue,
  classifyStaticLayer,
  cssCommentMaskCharacter,
  evaluateStaticLayerNumber,
  isCssIdentifierCharacter,
  isCssWhitespace,
  isCssWhitespaceOrComment,
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
const invalidCustomIdentKeywords = new Set([
  'default',
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'unset',
]);
const signedZeroSensitiveFunctionNames = new Set(['atan2', 'log', 'pow']);
const substitutionFunctionNames = new Set(['attr', 'env', 'var']);
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
  const maskedCharacters = value.split('');
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
    maskedCharacters.fill(cssCommentMaskCharacter, index, commentEnd);
    index = commentEnd - 1;
  }
  return maskedCharacters.join('');
}

function resolveFrameExpression(frame, value, range, budget, unresolvedReplacement) {
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
    const replacement = ` ${child.resolvedFallback ?? unresolvedReplacement} `;
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

function factorAfter(value, start, end, budget) {
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
  return value.slice(factorStart, start).trim();
}

function factorBefore(value, start, end, budget) {
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
  return value.slice(end + 1, factorEnd).trim();
}

function isPrecededByDivision(value, operandStart) {
  while (operandStart > 0 && isCssWhitespaceOrComment(value[operandStart - 1])) operandStart -= 1;
  return value[operandStart - 1] === '/';
}

function contextForOpeningParenthesis(value, openIndex, inheritedContext, inheritedMathContext) {
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
  const factor = factorBefore(value, range.start, beforeChild - 1, budget);
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
    if (factor !== undefined && isStaticallyZero(`calc(${child.resolvedFallback} * ${factor})`))
      return true;
  }

  let beforeChild = child.start;
  while (
    beforeChild > range.start &&
    (isCssWhitespaceOrComment(value[beforeChild - 1]) || value[beforeChild - 1] === '(')
  )
    beforeChild -= 1;
  if (value[beforeChild - 1] !== '*') return false;
  const factor = factorBefore(value, range.start, beforeChild - 1, budget);
  if (factor === fallbackResolutionTooComplex) return false;
  return factor !== undefined && isStaticallyZero(`calc(${factor} * ${child.resolvedFallback})`);
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
    '([{,'.includes(previousCharacter) ||
    ')]},'.includes(nextCharacter)
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

function directBannedMathArgumentCandidates(
  frame,
  value,
  range,
  candidate,
  budget,
  parenthesisPairs,
) {
  for (const functionName of ['max', 'min', 'clamp']) {
    const parsedArguments = fallbackIndependentStaticArguments(
      frame,
      value,
      range,
      functionName,
      parenthesisPairs,
    );
    if (!parsedArguments) continue;
    if (functionName === 'clamp' && parsedArguments.argumentCount !== 3) return [];
    const candidateArguments =
      functionName === 'clamp'
        ? parsedArguments.staticArguments.filter(
            (argument) => argument.index === 0 || argument.index === 2,
          )
        : parsedArguments.staticArguments;
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
  const progressRangeGroupIndexes = progressRanges.map((progressRange) => {
    const key =
      canonicalProgressRangeKey(frame, value, progressRange, parenthesisPairs) ??
      value.slice(progressRange.start, progressRange.end);
    const existingIndex = progressGroupIndexes.get(key);
    if (existingIndex !== undefined) return existingIndex;
    const groupIndex = progressGroupIndexes.size;
    progressGroupIndexes.set(key, groupIndex);
    return groupIndex;
  });
  const resolvedChildren = childrenOutsideProgressRanges;
  if (resolvedChildren.some((child) => typeof child.resolvedFallback !== 'string'))
    return emptyAnalysis;
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
    return isValidProgressRange(frame, value, argumentRange, parenthesisPairs);
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
      /^(?:\s+\d+)*$/.test(header.slice(identifierEnd))
    );
  if (frame.functionName !== 'attr') return false;
  const attrType = header.slice(identifierEnd).trim();
  if (attrType === '' || attrType === '%') return true;
  if (cssIdentifierTokenEnd(attrType, 0) === attrType.length) return true;
  const typeMatch = /^type\(([^()]+)\)$/i.exec(attrType);
  if (!typeMatch) return false;
  let hasOpenAngleBracket = false;
  for (const character of typeMatch[1]) {
    if (character === '<') {
      if (hasOpenAngleBracket) return false;
      hasOpenAngleBracket = true;
    } else if (character === '>') {
      if (!hasOpenAngleBracket) return false;
      hasOpenAngleBracket = false;
    }
  }
  return !hasOpenAngleBracket;
}

function hasBareOperatorStream(
  value,
  start = 0,
  end = value.length,
  budget,
  initialMathContext = false,
) {
  if (budget && !consumeResolutionWork(budget, end - start)) return false;
  const range = trimCssTriviaRange(value, start, end);
  if (value[range.start] === '(' && !initialMathContext) return true;
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
    const identifierEnd = cssIdentifierTokenEnd(value, index);
    if (identifierEnd > index) {
      index = identifierEnd - 1;
      continue;
    }
    if (character === '(') {
      parenthesisContexts.push(
        contextForOpeningParenthesis(
          value,
          index,
          false,
          parenthesisContexts.at(-1)?.mathContext ?? initialMathContext,
        ),
      );
    } else if (character === ')') parenthesisContexts.pop();
    else if (
      character === ',' &&
      (parenthesisContexts.length === 0 ||
        parenthesisContexts.at(-1)?.isGroupingParenthesis ||
        parenthesisContexts.at(-1)?.functionName === 'calc' ||
        parenthesisContexts.at(-1)?.functionName === '-webkit-calc')
    )
      return true;
    else if (
      (parenthesisContexts.at(-1)?.mathContext ?? initialMathContext) !== true &&
      /[+\-*/]/.test(character)
    ) {
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
  return /^[+-]?(?:e|pi|infinity|nan)$/i.test(value.trim());
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
  if (frame.resolvedClassification === 'too-complex') return [candidate];
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
  if (additiveNonNumberSuppression?.suppressesAllCandidates) return [];
  if (isValidProgressRange(frame, value, range, parenthesisPairs)) return [];
  const nestedCandidatesAreHiddenByBareOperatorStream =
    frame.resolvedClassification === 'unresolved' &&
    (frame.type === 'root'
      ? frame.hasInvalidCommaStream === true
      : hasBareOperatorStream(value, range.start, range.end, budget, frame.mathContext) ||
        hasAdjacentFallbackToken(frame, value, range, budget));
  const uneliminatedChildren = frame.children.filter(
    (child) =>
      child.unprovenBannedCandidates.length > 0 &&
      !nestedCandidatesAreHiddenByBareOperatorStream &&
      !(
        child.invalidFunctionParent?.end !== undefined &&
        child.invalidFunctionParent.functionStart >= range.start &&
        child.invalidFunctionParent.end <= range.end
      ) &&
      (resolvedNegativeZero || !childIsEliminatedByZeroProduct(value, range, child, budget)),
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
    .filter((childCandidate) => !candidateIsSuppressedByNonNumberTerm(childCandidate));
  const directArgumentCandidates =
    frame.resolvedClassification === 'unresolved'
      ? directBannedMathArgumentCandidates(
          frame,
          value,
          range,
          candidate,
          budget,
          parenthesisPairs,
        ).filter((childCandidate) => !candidateIsSuppressedByNonNumberTerm(childCandidate))
      : [];
  let runtimeZeroFallback = null;
  if (
    frame.resolvedClassification === 'unresolved' &&
    frame.children.some((child) => child.resolvedFallback === null)
  ) {
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
      value.slice(runtimeZeroRange.start, runtimeZeroRange.start + 6).toLowerCase() === 'round(' &&
      parenthesisPairs.get(runtimeZeroRange.start + 5) === runtimeZeroRange.end - 1;
    if (everyUnresolvedChildIsZeroed || fallbackIsRoundFunction)
      runtimeZeroFallback = resolveFrameExpression(frame, value, range, budget, '0');
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
  const uneliminatedCandidates =
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
      : [...childCandidates, ...directArgumentCandidates, ...boundedProgressCandidates];

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

  const [onlyChild] = frame.children;
  if (
    frame.type === 'root' &&
    frame.resolvedClassification === 'safe' &&
    frame.negativeZeroIsSafeFinalLayer
  )
    return [];
  // With exactly one fallback path, a concrete enclosing expression can prove
  // that path safe (for example, max(var(--layer, -1), 0)). An expression that
  // is only the child itself provides no such context.
  const hasSingleChildWithEnclosingContext =
    frame.children.length === 1 && (onlyChild.start !== range.start || onlyChild.end !== range.end);
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
      const frame = {
        type: 'fallback',
        functionName: functionMatch[0].slice(0, -1).toLowerCase(),
        start: index,
        openIndex: index + functionMatch[0].length - 1,
        commaIndex: -1,
        children: [],
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
