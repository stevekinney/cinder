import {
  classifyStaticLayer,
  isCssIdentifierCharacter,
  isCssWhitespace,
  isStaticallyNegativeZero,
  isStaticallyZero,
  normalizeCssEscapesForInspection,
} from './z-index-value-analysis.mjs';

const fallbackFunctionPattern = /(?:var|env|attr)\(/iy;
const fallbackResolutionTooComplex = Symbol('fallback-resolution-too-complex');
const fallbackResolutionWorkLimit = 8_000_000;
const signedZeroSensitiveFunctionNames = new Set(['atan2', 'log', 'pow']);
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

function trimCssWhitespaceRange(value, start, end) {
  while (start < end && isCssWhitespace(value[start])) start += 1;
  while (end > start && isCssWhitespace(value[end - 1])) end -= 1;
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

function resolveFrameExpression(frame, value, range, budget) {
  if (frame.children.some((child) => child.resolvedFallback === fallbackResolutionTooComplex))
    return fallbackResolutionTooComplex;
  if (frame.children.some((child) => child.resolvedFallback === null)) return null;

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
    const replacement = ` ${child.resolvedFallback} `;
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
  if (!consumeResolutionWork(budget, (end - start) * 4)) return undefined;
  while (start < end && isCssWhitespace(value[start])) start += 1;
  const factorStart = start;
  while (start < end && /[+-]/.test(value[start])) {
    start += 1;
    while (start < end && isCssWhitespace(value[start])) start += 1;
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
  if (!consumeResolutionWork(budget, (end - start) * 4)) return undefined;
  while (end > start && isCssWhitespace(value[end - 1])) end -= 1;
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
  while (operandStart > 0 && isCssWhitespace(value[operandStart - 1])) operandStart -= 1;
  return value[operandStart - 1] === '/';
}

function contextForOpeningParenthesis(value, openIndex, inheritedContext, inheritedMathContext) {
  let functionStart = openIndex;
  while (functionStart > 0 && isCssIdentifierCharacter(value[functionStart - 1]))
    functionStart -= 1;
  const functionName = value.slice(functionStart, openIndex).toLowerCase();
  const operandStart = functionName ? functionStart : openIndex;
  const parentRequiresSignedZero = inheritedContext || isPrecededByDivision(value, operandStart);
  return {
    functionName,
    mathContext: inheritedMathContext || mathFunctionNames.has(functionName),
    parentRequiresSignedZero,
    signedZeroSensitiveContext:
      parentRequiresSignedZero || signedZeroSensitiveFunctionNames.has(functionName),
  };
}

function childIsEliminatedByZeroProduct(value, range, child, budget) {
  if (child.signedZeroSensitiveContext) return false;
  if (typeof child.resolvedFallback !== 'string') return false;
  let afterChild = child.end;
  while (
    afterChild < range.end &&
    (isCssWhitespace(value[afterChild]) || value[afterChild] === ')')
  )
    afterChild += 1;
  if (value[afterChild] === '*') {
    const factor = factorAfter(value, afterChild + 1, range.end, budget);
    if (factor !== undefined && isStaticallyZero(`calc(${child.resolvedFallback} * ${factor})`))
      return true;
  }

  let beforeChild = child.start;
  while (
    beforeChild > range.start &&
    (isCssWhitespace(value[beforeChild - 1]) || value[beforeChild - 1] === '(')
  )
    beforeChild -= 1;
  if (value[beforeChild - 1] !== '*') return false;
  const factor = factorBefore(value, range.start, beforeChild - 1, budget);
  return factor !== undefined && isStaticallyZero(`calc(${factor} * ${child.resolvedFallback})`);
}

function classifyResolvedFallback(resolvedFallback) {
  if (resolvedFallback === fallbackResolutionTooComplex) return 'too-complex';
  return typeof resolvedFallback === 'string'
    ? classifyStaticLayer(resolvedFallback)
    : 'unresolved';
}

function unwrapStaticContainer(value, range) {
  const parenthesisPairs = new Map();
  const openParentheses = [];
  for (let index = range.start; index < range.end; index += 1) {
    if (value[index] === '"' || value[index] === "'") {
      index = quotedStringEnd(value, index);
      continue;
    }
    if (value[index] === '(') openParentheses.push(index);
    else if (value[index] === ')') {
      const openIndex = openParentheses.pop();
      if (openIndex !== undefined) parenthesisPairs.set(openIndex, index);
    }
  }

  let unwrappedRange = trimCssWhitespaceRange(value, range.start, range.end);
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
    unwrappedRange = trimCssWhitespaceRange(value, openIndex + 1, unwrappedRange.end - 1);
  }
}

function fallbackIndependentStaticArguments(frame, value, range, functionName) {
  const trimmedRange = unwrapStaticContainer(value, range);
  if (
    value.slice(trimmedRange.start, trimmedRange.start + functionName.length + 1).toLowerCase() !==
      `${functionName}(` ||
    value[trimmedRange.end - 1] !== ')'
  )
    return undefined;

  const argumentRanges = [];
  let argumentStart = trimmedRange.start + functionName.length + 1;
  let depth = 0;
  for (let index = argumentStart; index < trimmedRange.end - 1; index += 1) {
    if (value[index] === '"' || value[index] === "'") index = quotedStringEnd(value, index);
    else if (value[index] === '(') depth += 1;
    else if (value[index] === ')') {
      if (depth === 0) return undefined;
      depth -= 1;
    } else if (value[index] === ',' && depth === 0) {
      argumentRanges.push({ start: argumentStart, end: index });
      argumentStart = index + 1;
    }
  }
  if (depth !== 0) return undefined;
  argumentRanges.push({ start: argumentStart, end: trimmedRange.end - 1 });
  const arguments_ = argumentRanges.map((argumentRange) =>
    trimCssWhitespaceRange(value, argumentRange.start, argumentRange.end),
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
    return [{ index: argumentIndex, value: value.slice(argument.start, argument.end) }];
  });
  return {
    argumentCount: argumentRanges.length,
    argumentRanges: arguments_,
    staticArguments,
  };
}

function argumentWithFallbackPlaceholders(frame, value, range) {
  let expression = value.slice(range.start, range.end);
  for (let childIndex = frame.children.length - 1; childIndex >= 0; childIndex -= 1) {
    const child = frame.children[childIndex];
    if (child.start < range.start || child.end > range.end) continue;
    expression =
      expression.slice(0, child.start - range.start) +
      ' 0 ' +
      expression.slice(child.end - range.start);
  }
  return expression;
}

function hasFallbackIndependentSafeBound(frame, value, range, functionName) {
  return (
    fallbackIndependentStaticArguments(frame, value, range, functionName)?.staticArguments.some(
      (argument) =>
        functionName === 'min'
          ? classifyStaticLayer(`min(9999, ${argument.value})`) === 'safe'
          : classifyStaticLayer(argument.value) === 'safe' &&
            !(frame.signedZeroSensitiveContext && isStaticallyNegativeZero(argument.value)),
    ) ?? false
  );
}

function hasFallbackIndependentClampBound(frame, value, range, boundIndex, candidate) {
  const clampArguments = fallbackIndependentStaticArguments(frame, value, range, 'clamp');
  if (clampArguments?.argumentCount !== 3) return false;
  const centerExpression = argumentWithFallbackPlaceholders(
    frame,
    value,
    clampArguments.argumentRanges[1],
  );
  if (!['safe', 'negative', 'magic'].includes(classifyStaticLayer(centerExpression))) return false;
  const bound = clampArguments.staticArguments.find((argument) => argument.index === boundIndex);
  if (!bound) return false;
  return candidate === 'magic'
    ? classifyStaticLayer(`min(9999, ${bound.value})`) === 'safe'
    : classifyStaticLayer(bound.value) === 'safe' &&
        !(frame.signedZeroSensitiveContext && isStaticallyNegativeZero(bound.value));
}

function hasBareOperatorStream(value) {
  const expression = value.trim();
  if (expression.startsWith('(')) return true;
  let depth = 0;
  let sawTopLevelOperand = false;
  let previousNonWhitespace;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (character === '"' || character === "'") {
      index = quotedStringEnd(expression, index);
      continue;
    }
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (depth === 0 && (character === '*' || character === '/')) return true;
    else if (depth === 0 && (character === '+' || character === '-')) {
      const isIdentifierHyphen =
        character === '-' &&
        /[a-z_]/i.test(previousNonWhitespace ?? '') &&
        /[a-z_]/i.test(expression[index + 1] ?? '');
      const isUnary = !sawTopLevelOperand || previousNonWhitespace === 'e' || isIdentifierHyphen;
      if (!isUnary) return true;
    } else if (depth === 0 && !isCssWhitespace(character) && character !== ',')
      sawTopLevelOperand = true;
    if (!isCssWhitespace(character)) previousNonWhitespace = character.toLowerCase();
  }
  return false;
}

function isBareCalcOnlyConstant(value) {
  return /^[+-]?(?:e|pi|infinity|nan)$/i.test(value.trim());
}

function negativeZeroIsSafeFinalLayer(frame, value, range, budget) {
  if (!frame.resolvedNegativeZero) return false;
  const candidateChildren = frame.children.filter((child) => child.unprovenBannedCandidate);
  return (
    candidateChildren.length > 0 &&
    candidateChildren.every(
      (child) =>
        child.negativeZeroIsSafeFinalLayer ||
        childIsEliminatedByZeroProduct(value, range, child, budget),
    )
  );
}

function unprovenCandidateForFrame(frame, value, range, candidate, budget) {
  // Resolving every sibling fallback at once represents only one runtime path:
  // any sibling may instead use its defined custom-property value. Preserve a
  // banned child unless its contribution is safe independently of that choice.
  const resolvedNegativeZero = frame.type === 'fallback' && frame.resolvedNegativeZero === true;
  if (frame.resolvedClassification === 'too-complex') return candidate;
  const uneliminatedChildren = frame.children.filter(
    (child) =>
      child.unprovenBannedCandidate &&
      (resolvedNegativeZero || !childIsEliminatedByZeroProduct(value, range, child, budget)),
  );
  const [uneliminatedChild] = uneliminatedChildren;
  if (frame.resolvedClassification === 'negative' || frame.resolvedClassification === 'magic') {
    const matchingChild = uneliminatedChildren.find(
      (child) =>
        child.unprovenBannedCandidate.resolvedClassification === frame.resolvedClassification,
    );
    return (
      matchingChild?.unprovenBannedCandidate ??
      uneliminatedChild?.unprovenBannedCandidate ??
      candidate
    );
  }
  if (!uneliminatedChild) return undefined;

  const hasNonnegativeFloor =
    hasFallbackIndependentSafeBound(frame, value, range, 'max') ||
    hasFallbackIndependentClampBound(frame, value, range, 0, 'negative');
  const hasMagicCeiling =
    hasFallbackIndependentSafeBound(frame, value, range, 'min') ||
    hasFallbackIndependentClampBound(frame, value, range, 2, 'magic');
  const contextuallyUnprovenChildren = uneliminatedChildren.filter((child) => {
    const classification = child.unprovenBannedCandidate.resolvedClassification;
    return !(
      (hasNonnegativeFloor && classification === 'negative') ||
      (hasMagicCeiling && classification === 'magic')
    );
  });
  if (contextuallyUnprovenChildren.length === 0) return undefined;

  const [onlyChild] = frame.children;
  if (
    frame.type === 'root' &&
    frame.resolvedClassification === 'safe' &&
    frame.negativeZeroIsSafeFinalLayer
  )
    return undefined;
  // With exactly one fallback path, a concrete enclosing expression can prove
  // that path safe (for example, max(var(--layer, -1), 0)). An expression that
  // is only the child itself provides no such context.
  const hasSingleChildWithEnclosingContext =
    frame.children.length === 1 && (onlyChild.start !== range.start || onlyChild.end !== range.end);
  if (frame.resolvedClassification !== 'safe')
    return contextuallyUnprovenChildren[0].unprovenBannedCandidate;
  const contextuallyUnprovenCandidate = contextuallyUnprovenChildren[0].unprovenBannedCandidate;
  if (
    hasSingleChildWithEnclosingContext &&
    !resolvedNegativeZero &&
    !contextuallyUnprovenCandidate.hasRuntimeSibling
  )
    return undefined;
  return contextuallyUnprovenCandidate;
}

// Parse every var()/env()/attr() fallback in one pass with an explicit
// parentheses stack. Each closed function is resolved bottom-up by substituting
// direct nested fallback paths; the root frame propagates them into enclosing
// declaration arithmetic without recursion.
function fallbackCandidates(value) {
  const candidates = [];
  const parentheses = [];
  const fallbackFrames = [];
  const rootFrame = { type: 'root', children: [] };
  const resolutionBudget = { remaining: fallbackResolutionWorkLimit };

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"' || value[index] === "'") {
      index = quotedStringEnd(value, index);
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
        start: index,
        openIndex: index + functionMatch[0].length - 1,
        commaIndex: -1,
        children: [],
        resolvedFallback: null,
        resolvedClassification: 'unresolved',
        mathContext: parentheses.at(-1)?.mathContext === true,
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
      const context = contextForOpeningParenthesis(
        value,
        index,
        parentheses.at(-1)?.signedZeroSensitiveContext === true,
        parentheses.at(-1)?.mathContext === true,
      );
      parentheses.push({
        type: 'group',
        ...context,
      });
      continue;
    }
    if (value[index] === ',') {
      const frame = parentheses.at(-1);
      if (frame?.type === 'fallback' && frame.commaIndex === -1) frame.commaIndex = index;
      else if (frame?.type === 'group' && frame.functionName === 'rem')
        frame.signedZeroSensitiveContext = false;
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
    frame.resolvedFallback = resolveFrameExpression(frame, value, fallbackRange, resolutionBudget);
    const [onlyChild] = frame.children;
    frame.resolvedClassification =
      frame.children.length === 1 &&
      onlyChild.start === fallbackRange.start &&
      onlyChild.end === fallbackRange.end
        ? onlyChild.resolvedClassification
        : !frame.mathContext &&
            typeof frame.resolvedFallback === 'string' &&
            (hasBareOperatorStream(frame.resolvedFallback) ||
              isBareCalcOnlyConstant(frame.resolvedFallback))
          ? 'unresolved'
          : classifyResolvedFallback(frame.resolvedFallback);
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
    frame.unprovenBannedCandidate = unprovenCandidateForFrame(
      frame,
      value,
      fallbackRange,
      candidate,
      resolutionBudget,
    );
    if (frame.unprovenBannedCandidate && frame.children.length > 1)
      frame.unprovenBannedCandidate = {
        ...frame.unprovenBannedCandidate,
        hasRuntimeSibling: true,
      };
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
    rootFrame.resolvedClassification =
      rootFrame.children.length === 1 &&
      onlyRootChild.start === 0 &&
      onlyRootChild.end === value.length
        ? onlyRootChild.resolvedClassification
        : classifyResolvedFallback(resolvedValue);
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
    const unprovenRootCandidate = unprovenCandidateForFrame(
      rootFrame,
      value,
      { start: 0, end: value.length },
      rootCandidate,
      resolutionBudget,
    );
    if (unprovenRootCandidate) candidates.push(unprovenRootCandidate);
  }

  return candidates;
}

export function bannedFallback(value) {
  const { value: decodedValue, sourceRanges } = normalizeCssEscapesForInspection(value);
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
