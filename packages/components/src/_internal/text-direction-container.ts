export function parseStyleQuery(
  conditionText: string,
): { index: number; end: number; name: string; value: string } | undefined {
  const start = /style\(\s*(--[\w-]+)\s*:\s*/i.exec(conditionText);
  if (!start || !start[1]) return undefined;
  let depth = 0;
  for (let index = start.index + start[0].length; index < conditionText.length; index += 1) {
    const character = conditionText[index];
    if (character === '(') depth += 1;
    if (character === ')') {
      if (depth === 0)
        return {
          index: start.index,
          end: index + 1,
          name: start[1],
          value: conditionText.slice(start.index + start[0].length, index),
        };
      depth -= 1;
    }
  }
  return undefined;
}
function splitTopLevel(conditionText: string, operator: 'and' | 'or'): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let index = 0;
  while (index < conditionText.length) {
    const character = conditionText[index];
    if (character === '(') {
      depth += 1;
      index += 1;
      continue;
    }
    if (character === ')') {
      depth = Math.max(0, depth - 1);
      index += 1;
      continue;
    }
    if (
      depth === 0 &&
      conditionText.slice(index, index + operator.length).toLowerCase() === operator &&
      /\s/.test(conditionText[index - 1] ?? '') &&
      /\s/.test(conditionText[index + operator.length] ?? '')
    ) {
      parts.push(conditionText.slice(start, index));
      index += operator.length;
      start = index;
      continue;
    }
    index += 1;
  }
  parts.push(conditionText.slice(start));
  return parts;
}
export function evaluateLogicalContainerCondition(
  conditionText: string,
  width: number,
  remSize: number,
  inlineSize: number,
): boolean {
  if (!isFullyParsedContainerCondition(conditionText)) return false;
  return evaluateParsedLogicalContainerCondition(conditionText, width, remSize, inlineSize);
}
function evaluateParsedLogicalContainerCondition(
  conditionText: string,
  width: number,
  remSize: number,
  inlineSize: number,
): boolean {
  const orParts = splitTopLevel(conditionText, 'or');
  if (orParts.length > 1)
    return orParts.some((part) =>
      evaluateParsedLogicalContainerCondition(part, width, remSize, inlineSize),
    );
  const andParts = splitTopLevel(conditionText, 'and');
  if (andParts.length > 1)
    return andParts.every((part) =>
      evaluateParsedLogicalContainerCondition(part, width, remSize, inlineSize),
    );
  const trimmed = conditionText.trim();
  const unwrapped = unwrapRedundantParentheses(trimmed);
  if (unwrapped !== trimmed)
    return evaluateParsedLogicalContainerCondition(unwrapped, width, remSize, inlineSize);
  const notPrefix = /^not\s+/i.exec(trimmed);
  if (notPrefix)
    return !evaluateParsedLogicalContainerCondition(
      trimmed.slice(notPrefix[0].length),
      width,
      remSize,
      inlineSize,
    );
  return evaluateContainerSizeConstraints(trimmed, width, remSize, inlineSize);
}
const containerSizeTermPattern =
  /^(?:(?:min|max)-(?:width|inline-size)|(?:width|inline-size))\s*:\s*(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem)$/i;
const featureFirstRangePattern =
  /^(?:width|inline-size)\s*(?:>=|>|<=|<)\s*(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem)$/i;
const valueFirstRangePattern =
  /^(?:(?:(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem)\s*(?:<=|<)\s*(?:width|inline-size))(?:\s*(?:<=|<)\s*(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem))?|(?:(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem)\s*(?:>=|>)\s*(?:width|inline-size))(?:\s*(?:>=|>)\s*(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem))?)$/i;
export function isFullyParsedContainerCondition(conditionText: string): boolean {
  const trimmed = conditionText.trim();
  if (!trimmed || !hasBalancedParentheses(trimmed)) return false;
  return parseContainerCondition(trimmed);
}
function parseContainerCondition(conditionText: string, isTopLevelCondition = true): boolean {
  const original = conditionText.trim();
  const trimmed = unwrapRedundantParentheses(original);
  const wasGrouped = trimmed !== original;
  const orParts = splitTopLevel(trimmed, 'or');
  const andParts = splitTopLevel(trimmed, 'and');
  if (orParts.length > 1 || andParts.length > 1)
    return parseLogicalContainerParts(orParts, andParts);
  const notPrefix = /^not\s+/i.exec(trimmed);
  if (notPrefix)
    return parseNotContainerCondition(trimmed, notPrefix[0], isTopLevelCondition, wasGrouped);
  return (
    wasGrouped &&
    (containerSizeTermPattern.test(trimmed) ||
      featureFirstRangePattern.test(trimmed) ||
      valueFirstRangePattern.test(trimmed))
  );
}
function parseNotContainerCondition(
  value: string,
  prefix: string,
  isTopLevel: boolean,
  wasGrouped: boolean,
): boolean {
  if (!isTopLevel && !wasGrouped) return false;
  const operand = value.slice(prefix.length).trim();
  return unwrapRedundantParentheses(operand) !== operand && parseContainerCondition(operand);
}
function parseLogicalContainerParts(orParts: string[], andParts: string[]): boolean {
  if (orParts.length > 1 && andParts.length > 1) return false;
  const parts = orParts.length > 1 ? orParts : andParts;
  return parts.every((part) => parseContainerCondition(part, false));
}
function hasBalancedParentheses(conditionText: string): boolean {
  let depth = 0;
  for (const character of conditionText) {
    if (character === '(') depth += 1;
    if (character === ')') {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}
function unwrapRedundantParentheses(conditionText: string): string {
  const trimmed = conditionText.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return trimmed;
  const matchingClose = matchParentheses(trimmed);
  if (!matchingClose) return trimmed;
  const { start, end } = trimEnclosingGroups(trimmed, matchingClose);
  return start === 0 ? trimmed : trimmed.slice(start, end + 1).trim();
}
function trimEnclosingGroups(
  value: string,
  matchingClose: Map<number, number>,
): { start: number; end: number } {
  let start = 0;
  let end = value.length - 1;
  while (start < end && matchingClose.get(start) === end) {
    start += 1;
    end -= 1;
    while (/\s/.test(value[start] ?? '')) start += 1;
    while (/\s/.test(value[end] ?? '')) end -= 1;
  }
  return { start, end };
}
function matchParentheses(value: string): Map<number, number> | undefined {
  const matchingClose = new Map<number, number>();
  const openPositions: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') openPositions.push(index);
    if (value[index] === ')') {
      const open = openPositions.pop();
      if (open === undefined) return undefined;
      matchingClose.set(open, index);
    }
  }
  return openPositions.length === 0 ? matchingClose : undefined;
}
export function hasUnsupportedContainerSizeQuery(conditionText: string): boolean {
  if (/(?:min-|max-)?(?:height|block-size)\b/i.test(conditionText)) return true;
  if (/\baspect-ratio\b/i.test(conditionText)) return true;
  if (/\borientation\s*:/i.test(conditionText)) return true;
  const featureFirstUnitMatches = conditionText.matchAll(
    /(?:min-|max-)?(?:width|inline-size)\s*(?:>=|>|<=|<|:)\s*[\d.]+([a-z%]+)/gi,
  );
  const valueFirstUnitMatches = conditionText.matchAll(
    /[\d.]+([a-z%]+)\s*(?:>=|>|<=|<)\s*(?:width|inline-size)/gi,
  );
  return [...featureFirstUnitMatches, ...valueFirstUnitMatches].some(
    (match) => !/^(?:px|rem)$/i.test(match[1]!),
  );
}
function evaluateRangeComparisons(
  conditionText: string,
  width: number,
  remSize: number,
): boolean | undefined {
  const featureFirstPattern = /(?:width|inline-size)\s*(>=|>|<=|<)\s*([\d.]+)(px|rem)/gi;
  const valueFirstPattern = /([\d.]+)(px|rem)\s*(<=|<|>=|>)\s*(width|inline-size)/gi;
  const comparisons: { operator: string; threshold: string; unit: string }[] = [];
  for (const comparison of conditionText.matchAll(featureFirstPattern)) {
    const operator = comparison[1];
    const threshold = comparison[2];
    const unit = comparison[3];
    if (operator && threshold && unit) comparisons.push({ operator, threshold, unit });
  }
  for (const comparison of conditionText.matchAll(valueFirstPattern)) {
    const threshold = comparison[1];
    const unit = comparison[2];
    const operator = reverseComparisonOperator(comparison[3]);
    if (threshold && unit) comparisons.push({ operator, threshold, unit });
  }
  if (comparisons.length === 0) return undefined;
  return comparisons.every((comparison) =>
    compareRange(
      width,
      comparison.operator,
      Number(comparison.threshold) * (comparison.unit.toLowerCase() === 'rem' ? remSize : 1),
    ),
  );
}
function reverseComparisonOperator(operator: string | undefined): string {
  if (operator === '<=') return '>=';
  if (operator === '<') return '>';
  if (operator === '>=') return '<=';
  return '<';
}
function compareRange(width: number, operator: string, threshold: number): boolean {
  if (operator === '>=') return width >= threshold;
  if (operator === '>') return width > threshold;
  if (operator === '<=') return width <= threshold;
  return width < threshold;
}
function evaluateEqualityComparison(
  conditionText: string,
  width: number,
  remSize: number,
): boolean | undefined {
  const equalityPattern = /(?:^|[\s(])(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/gi;
  const comparisons = [...conditionText.matchAll(equalityPattern)];
  if (comparisons.length === 0) return undefined;
  const satisfiesAll = comparisons.every((comparison) => {
    const threshold =
      Number(comparison[1]) * (comparison[2]!.toLowerCase() === 'rem' ? remSize : 1);
    return width === threshold;
  });
  return satisfiesAll;
}
function evaluateContainerSizeConstraints(
  conditionText: string,
  width: number,
  remSize: number,
  inlineSize = width,
): boolean {
  const measuredSize =
    /\binline-size\b/i.test(conditionText) && !/\bwidth\b/i.test(conditionText)
      ? inlineSize
      : width;
  const minimum = /min-(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const maximum = /max-(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const toPixels = (value: RegExpExecArray) =>
    Number(value[1]) * (value[2]!.toLowerCase() === 'rem' ? remSize : 1);
  const combinedMatches = evaluateContainerTerms(
    conditionText,
    measuredSize,
    remSize,
    minimum,
    maximum,
    toPixels,
  );
  return /^\s*not\b/i.test(conditionText) ? !combinedMatches : combinedMatches;
}
function evaluateContainerTerms(
  conditionText: string,
  measuredSize: number,
  remSize: number,
  minimum: RegExpExecArray | null,
  maximum: RegExpExecArray | null,
  toPixels: (value: RegExpExecArray) => number,
): boolean {
  const legacyMatches = evaluateLegacyTerms(measuredSize, minimum, maximum, toPixels);
  const rangeMatches = evaluateRangeComparisons(conditionText, measuredSize, remSize) ?? true;
  const equalityMatches = evaluateEqualityComparison(conditionText, measuredSize, remSize) ?? true;
  if (!hasRecognizedContainerTerm(conditionText, minimum, maximum)) return false;
  return legacyMatches && rangeMatches && equalityMatches;
}
function evaluateLegacyTerms(
  measuredSize: number,
  minimum: RegExpExecArray | null,
  maximum: RegExpExecArray | null,
  toPixels: (value: RegExpExecArray) => number,
): boolean {
  return (
    (!minimum || measuredSize >= toPixels(minimum)) &&
    (!maximum || measuredSize <= toPixels(maximum))
  );
}
function hasRecognizedContainerTerm(
  conditionText: string,
  minimum: RegExpExecArray | null,
  maximum: RegExpExecArray | null,
): boolean {
  const hasFeature = /\b(?:width|inline-size)\b/i.test(conditionText);
  const hasRange =
    /(?:width|inline-size)\s*(?:>=|>|<=|<)\s*[\d.]+(?:px|rem)/i.test(conditionText) ||
    /[\d.]+(?:px|rem)\s*(?:<=|<|>=|>)\s*(?:width|inline-size)/i.test(conditionText);
  return (
    !hasFeature ||
    Boolean(
      minimum ||
      maximum ||
      hasRange ||
      /(?:width|inline-size)\s*:\s*[\d.]+(?:px|rem)/i.test(conditionText),
    )
  );
}
