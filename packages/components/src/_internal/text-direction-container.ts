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
  /^(?:(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem)\s*(?:<=|<|>=|>)\s*(?:width|inline-size))(?:\s*(?:<=|<|>=|>)\s*(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem))?$/i;

/**
 * Returns true only when every token in a size condition belongs to the
 * deliberately small grammar evaluated below. Unknown CSS syntax must not
 * silently inherit the evaluator's historical "active" default.
 */
export function isFullyParsedContainerCondition(conditionText: string): boolean {
  const trimmed = conditionText.trim();
  if (!trimmed || !hasBalancedParentheses(trimmed)) return false;
  return parseContainerCondition(trimmed);
}

function parseContainerCondition(conditionText: string): boolean {
  const trimmed = unwrapRedundantParentheses(conditionText);
  const orParts = splitTopLevel(trimmed, 'or');
  if (orParts.length > 1) return orParts.every(parseContainerCondition);
  const andParts = splitTopLevel(trimmed, 'and');
  if (andParts.length > 1) return andParts.every(parseContainerCondition);
  const notPrefix = /^not\s+/i.exec(trimmed);
  if (notPrefix) {
    const operand = trimmed.slice(notPrefix[0].length).trim();
    const unwrappedOperand = unwrapRedundantParentheses(operand);
    return unwrappedOperand !== operand && parseContainerCondition(unwrappedOperand);
  }
  return (
    containerSizeTermPattern.test(trimmed) ||
    featureFirstRangePattern.test(trimmed) ||
    valueFirstRangePattern.test(trimmed)
  );
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
  const matchingClose = new Map<number, number>();
  const openPositions: number[] = [];
  let depth = 0;
  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] === '(') {
      openPositions.push(index);
      depth += 1;
    } else if (trimmed[index] === ')') {
      const open = openPositions.pop();
      if (open === undefined) return trimmed;
      matchingClose.set(open, index);
      depth -= 1;
    }
  }
  if (depth !== 0) return trimmed;
  let start = 0;
  let end = trimmed.length - 1;
  while (start < end && matchingClose.get(start) === end) {
    start += 1;
    end -= 1;
    while (/\s/.test(trimmed[start] ?? '')) start += 1;
    while (/\s/.test(trimmed[end] ?? '')) end -= 1;
  }
  return start === 0 ? trimmed : trimmed.slice(start, end + 1).trim();
}

// True when the condition references a width/inline-size comparison whose
// unit is not `px` or `rem` — the only units this evaluator can resolve to
// pixels — or references a size feature this evaluator doesn't implement at
// all (`height`, `block-size`, `aspect-ratio`, `orientation`, ...). Callers
// should fail closed rather than guess.
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

// A conjunctive range condition — e.g. `(width >= 20rem) and (width <= 40rem)`
// — has more than one range comparison to satisfy. Evaluate every one
// (`matchAll`, not a single `exec()`) and require all of them to hold.
// Returns undefined when the condition contains no range comparison at all.
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
    const operator =
      comparison[3] === '<='
        ? '>='
        : comparison[3] === '<'
          ? '>'
          : comparison[3] === '>='
            ? '<='
            : '<';
    if (threshold && unit) comparisons.push({ operator, threshold, unit });
  }
  if (comparisons.length === 0) return undefined;
  const satisfiesAll = comparisons.every((comparison) => {
    const { operator } = comparison;
    const threshold =
      Number(comparison.threshold) * (comparison.unit.toLowerCase() === 'rem' ? remSize : 1);
    if (operator === '>=') return width >= threshold;
    if (operator === '>') return width > threshold;
    if (operator === '<=') return width <= threshold;
    return width < threshold;
  });
  return satisfiesAll;
}

// The equality form — e.g. `(width: 20rem)` — has no `min-`/`max-` prefix
// and no comparison operator, so neither `minimum`/`maximum` nor
// evaluateRangeComparisons() recognizes it; without this, `matches`
// silently defaults to true regardless of the container's actual size.
// Returns undefined when the condition contains no bare equality term.
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
  if (
    /\bwidth\b/i.test(conditionText) &&
    /\binline-size\b/i.test(conditionText) &&
    /\band\b/i.test(conditionText)
  ) {
    return conditionText
      .split(/\s+and\s+/i)
      .every((clause) =>
        evaluateContainerSizeConstraints(
          clause,
          /\binline-size\b/i.test(clause) ? inlineSize : width,
          remSize,
          inlineSize,
        ),
      );
  }
  const minimum = /min-(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const maximum = /max-(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const toPixels = (value: RegExpExecArray) =>
    Number(value[1]) * (value[2]!.toLowerCase() === 'rem' ? remSize : 1);
  const legacyMatches =
    (!minimum || measuredSize >= toPixels(minimum)) &&
    (!maximum || measuredSize <= toPixels(maximum));
  const rangeMatches = evaluateRangeComparisons(conditionText, measuredSize, remSize) ?? true;
  const equalityMatches = evaluateEqualityComparison(conditionText, measuredSize, remSize) ?? true;
  const hasSizeFeature = /\b(?:width|inline-size)\b/i.test(conditionText);
  const hasRecognizedRange =
    /(?:width|inline-size)\s*(?:>=|>|<=|<)\s*[\d.]+(?:px|rem)/i.test(conditionText) ||
    /[\d.]+(?:px|rem)\s*(?:<=|<|>=|>)\s*(?:width|inline-size)/i.test(conditionText);
  const hasRecognizedEquality = /(?:width|inline-size)\s*:\s*[\d.]+(?:px|rem)/i.test(conditionText);
  if (hasSizeFeature && !minimum && !maximum && !hasRecognizedRange && !hasRecognizedEquality)
    return false;
  const combinedMatches = legacyMatches && rangeMatches && equalityMatches;
  return /^\s*not\b/i.test(conditionText) ? !combinedMatches : combinedMatches;
}
