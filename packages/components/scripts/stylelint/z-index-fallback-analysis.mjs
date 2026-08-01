import {
  decodeCssEscapes,
  isCssIdentifierCharacter,
  isCssWhitespace,
  isStaticallyMagicNumber,
  isStaticallyNegative,
  protectCssSyntaxEscapes,
} from './z-index-value-analysis.mjs';

const fallbackFunctionPattern = /(?:var|env|attr)\(/iy;

function trimCssWhitespaceRange(value, start, end) {
  while (start < end && isCssWhitespace(value[start])) start += 1;
  while (end > start && isCssWhitespace(value[end - 1])) end -= 1;
  return { start, end };
}

function resolveFrameExpression(frame, value, range) {
  const rawExpression = value.slice(range.start, range.end);
  if (frame.children.some((child) => child.resolvedFallback === null)) return null;

  const [onlyChild] = frame.children;
  if (frame.children.length === 1 && onlyChild.start === range.start && onlyChild.end === range.end)
    return onlyChild.resolvedFallback;

  let resolvedExpression = rawExpression;
  for (const child of frame.children.toReversed()) {
    const relativeStart = child.start - range.start;
    const relativeEnd = child.end - range.start;
    resolvedExpression =
      resolvedExpression.slice(0, relativeStart) +
      `(${child.resolvedFallback})` +
      resolvedExpression.slice(relativeEnd);
  }
  return resolvedExpression;
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
    frame.resolvedFallback = resolveFrameExpression(frame, value, fallbackRange);
    if (!frame.isNestedFallback)
      candidates.push({
        fallbackIndex: fallbackRange.start,
        rawFallback,
        resolvedFallback: frame.resolvedFallback,
      });
  }

  if (rootFrame.children.length > 0) {
    const resolvedValue = resolveFrameExpression(rootFrame, value, { start: 0, end: value.length });
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
      resolvedFallback !== null &&
      (isStaticallyNegative(resolvedFallback) || isStaticallyMagicNumber(resolvedFallback))
    )
      return {
        index: positionsAreStable ? fallbackIndex : undefined,
        value: rawFallback,
      };
  }
  return undefined;
}
