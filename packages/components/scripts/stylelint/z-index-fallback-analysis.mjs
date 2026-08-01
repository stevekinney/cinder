import {
  decodeCssEscapes,
  isCssIdentifierCharacter,
  isCssWhitespace,
  isStaticallyMagicNumber,
  isStaticallyNegative,
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
    const replacement = `(${child.resolvedFallback})`;
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

function childIsEliminatedByZeroProduct(value, range, child) {
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
        isNestedFallback: nearestFunction !== undefined && nearestFunction.commaIndex !== -1,
        resolvedFallback: null,
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
    const candidate = {
      fallbackIndex: fallbackRange.start,
      rawFallback,
      resolvedFallback: frame.resolvedFallback,
    };
    const resolvedFallbackIsBanned =
      typeof frame.resolvedFallback === 'string' &&
      (isStaticallyNegative(frame.resolvedFallback) ||
        isStaticallyMagicNumber(frame.resolvedFallback));
    frame.unprovenBannedCandidate = resolvedFallbackIsBanned
      ? candidate
      : frame.resolvedFallback === null
        ? frame.children.find(
            (child) =>
              child.unprovenBannedCandidate &&
              !childIsEliminatedByZeroProduct(value, fallbackRange, child),
          )?.unprovenBannedCandidate
        : undefined;
    if (!frame.isNestedFallback)
      candidates.push(
        candidate,
        ...(frame.resolvedFallback === null && frame.unprovenBannedCandidate
          ? [frame.unprovenBannedCandidate]
          : []),
      );
  }

  if (rootFrame.children.length > 0) {
    const resolvedValue = resolveFrameExpression(
      rootFrame,
      value,
      { start: 0, end: value.length },
      resolutionBudget,
    );
    candidates.push({ fallbackIndex: 0, rawFallback: value, resolvedFallback: resolvedValue });
  }

  return candidates;
}

export function bannedFallback(value) {
  const protectedValue = protectCssSyntaxEscapes(value);
  const decodedValue = decodeCssEscapes(protectedValue);
  const positionsAreStable = protectedValue === value && decodedValue === value;
  for (const { fallbackIndex, rawFallback, resolvedFallback } of fallbackCandidates(decodedValue)) {
    if (
      resolvedFallback === fallbackResolutionTooComplex ||
      (typeof resolvedFallback === 'string' &&
        (isStaticallyNegative(resolvedFallback) || isStaticallyMagicNumber(resolvedFallback)))
    )
      return {
        index: positionsAreStable ? fallbackIndex : undefined,
        value: rawFallback,
      };
  }
  return undefined;
}
