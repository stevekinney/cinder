import {
  classifyStaticLayer,
  decodeCssEscapes,
  isCssIdentifierCharacter,
  isCssWhitespace,
  isStaticallyZero,
  protectCssSyntaxEscapes,
} from './z-index-value-analysis.mjs';

const fallbackFunctionPattern = /(?:var|env|attr)\(/iy;
const fallbackResolutionTooComplex = Symbol('fallback-resolution-too-complex');
const fallbackResolutionWorkLimit = 8_000_000;

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

function factorAfter(value, start, end) {
  while (start < end && isCssWhitespace(value[start])) start += 1;
  const factorStart = start;
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

function factorBefore(value, start, end) {
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

function childIsInsideDivisionDenominator(value, range, child) {
  const openings = [];
  for (let index = range.start; index < child.start; index += 1) {
    if (value[index] === '(') openings.push(index);
    else if (value[index] === ')') openings.pop();
  }

  return openings.some((openIndex) => {
    let operandStart = openIndex;
    while (operandStart > range.start && isCssIdentifierCharacter(value[operandStart - 1]))
      operandStart -= 1;
    while (operandStart > range.start && isCssWhitespace(value[operandStart - 1]))
      operandStart -= 1;
    return value[operandStart - 1] === '/';
  });
}

function childIsEliminatedByZeroProduct(value, range, child) {
  if (childIsInsideDivisionDenominator(value, range, child)) return false;
  let afterChild = child.end;
  while (
    afterChild < range.end &&
    (isCssWhitespace(value[afterChild]) || value[afterChild] === ')')
  )
    afterChild += 1;
  if (value[afterChild] === '*' && isStaticallyZero(factorAfter(value, afterChild + 1, range.end)))
    return true;

  let beforeChild = child.start;
  while (
    beforeChild > range.start &&
    (isCssWhitespace(value[beforeChild - 1]) || value[beforeChild - 1] === '(')
  )
    beforeChild -= 1;
  return (
    value[beforeChild - 1] === '*' &&
    isStaticallyZero(factorBefore(value, range.start, beforeChild - 1))
  );
}

function classifyResolvedFallback(resolvedFallback) {
  if (resolvedFallback === fallbackResolutionTooComplex) return 'too-complex';
  return typeof resolvedFallback === 'string'
    ? classifyStaticLayer(resolvedFallback)
    : 'unresolved';
}

function unprovenCandidateForFrame(frame, value, range, candidate) {
  // Resolving every sibling fallback at once represents only one runtime path:
  // any sibling may instead use its defined custom-property value. Preserve a
  // banned child unless its contribution is safe independently of that choice.
  const uneliminatedChild = frame.children.find(
    (child) =>
      child.unprovenBannedCandidate && !childIsEliminatedByZeroProduct(value, range, child),
  );
  if (frame.resolvedClassification === 'too-complex') return candidate;
  if (frame.resolvedClassification === 'negative' || frame.resolvedClassification === 'magic')
    return uneliminatedChild?.unprovenBannedCandidate ?? candidate;
  if (!uneliminatedChild) return undefined;

  const [onlyChild] = frame.children;
  // With exactly one fallback path, a concrete enclosing expression can prove
  // that path safe (for example, max(var(--layer, -1), 0)). An expression that
  // is only the child itself provides no such context.
  const hasSingleChildWithEnclosingContext =
    frame.children.length === 1 && (onlyChild.start !== range.start || onlyChild.end !== range.end);
  return frame.resolvedClassification === 'safe' && hasSingleChildWithEnclosingContext
    ? undefined
    : uneliminatedChild.unprovenBannedCandidate;
}

// Parse every var()/env()/attr() fallback in one pass with an explicit
// parentheses stack. Each closed function is resolved bottom-up by substituting
// direct nested fallback paths; the root frame propagates them into enclosing
// declaration arithmetic without recursion.
function fallbackCandidates(value) {
  const candidates = [];
  const parentheses = [];
  const fallbackFrames = [];
  const rootFrame = { children: [] };
  const resolutionBudget = { remaining: fallbackResolutionWorkLimit };

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
        resolvedClassification: 'unresolved',
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
    frame.resolvedFallback = resolveFrameExpression(frame, value, fallbackRange, resolutionBudget);
    const [onlyChild] = frame.children;
    frame.resolvedClassification =
      frame.children.length === 1 &&
      onlyChild.start === fallbackRange.start &&
      onlyChild.end === fallbackRange.end
        ? onlyChild.resolvedClassification
        : classifyResolvedFallback(frame.resolvedFallback);
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
    );
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
    );
    if (unprovenRootCandidate) candidates.push(unprovenRootCandidate);
  }

  return candidates;
}

export function bannedFallback(value) {
  const protectedValue = protectCssSyntaxEscapes(value);
  const decodedValue = decodeCssEscapes(protectedValue);
  const positionsAreStable = protectedValue === value && decodedValue === value;
  for (const { fallbackIndex, rawFallback, resolvedClassification } of fallbackCandidates(
    decodedValue,
  )) {
    const analysisWasTooComplex = resolvedClassification === 'too-complex';
    if (
      analysisWasTooComplex ||
      resolvedClassification === 'negative' ||
      resolvedClassification === 'magic'
    )
      return {
        index: positionsAreStable ? fallbackIndex : undefined,
        value: rawFallback,
        reason: analysisWasTooComplex ? 'too-complex' : 'banned',
      };
  }
  return undefined;
}
