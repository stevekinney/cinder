const NUMERIC_LITERAL_PATTERN = String.raw`\d[\d_]*(?:\.\d[\d_]*)?`;
const FLAT_NUMERIC_EXPRESSION_PATTERN = String.raw`${NUMERIC_LITERAL_PATTERN}(?:\s*[*/+-]\s*${NUMERIC_LITERAL_PATTERN})*`;
const NUMERIC_ATOM_PATTERN = String.raw`(?:${NUMERIC_LITERAL_PATTERN}|\(\s*${FLAT_NUMERIC_EXPRESSION_PATTERN}\s*\))`;

export const NUMERIC_EXPRESSION_PATTERN = String.raw`${NUMERIC_ATOM_PATTERN}(?:\s*[*/+-]\s*${NUMERIC_ATOM_PATTERN})*`;

export function parseNumericLiteral(literal: string): number {
  const normalized = literal.replaceAll('_', '').replace(/\s+/gu, '');
  const tokens = normalized.match(/\d+(?:\.\d+)?|[()*/+-]/gu);
  if (tokens === null || tokens.join('') !== normalized) return Number.NaN;
  let index = 0;

  const readFactor = (): number => {
    if (tokens[index] === '(') {
      index += 1;
      const value = readExpression();
      if (tokens[index] !== ')') return Number.NaN;
      index += 1;
      return value;
    }
    const value = Number(tokens[index]);
    index += 1;
    return value;
  };
  const readTerm = (): number => {
    let value = readFactor();
    while (tokens[index] === '*' || tokens[index] === '/') {
      const operator = tokens[index];
      index += 1;
      const operand = readFactor();
      value = operator === '*' ? value * operand : value / operand;
    }
    return value;
  };
  const readExpression = (): number => {
    let value = readTerm();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index];
      index += 1;
      const operand = readTerm();
      value = operator === '+' ? value + operand : value - operand;
    }
    return value;
  };

  const value = readExpression();
  return index === tokens.length ? value : Number.NaN;
}

export function effectiveThresholdValue(label: string, line: string, value: number): number {
  if (value !== 0) return value;
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel.includes('retr') || normalizedLabel.includes('slow')) return value;
  if (normalizedLabel === 'bun.sleep' || normalizedLabel === 'waitfortimeout') return value;
  if (normalizedLabel === 'settimeout' && !/\btest\.setTimeout\s*\(/u.test(line)) return value;
  return Number.POSITIVE_INFINITY;
}

export type BunTestTimeoutArgument = {
  offset: number;
  renderedValue: string;
};

export type WaitThresholdArgument = BunTestTimeoutArgument & {
  label: 'bun.sleep' | 'setTimeout';
};

function findCallArgument(
  analysis: string,
  callPattern: RegExp,
  argumentIndex: number,
  label: WaitThresholdArgument['label'],
): WaitThresholdArgument[] {
  const argumentsFound: WaitThresholdArgument[] = [];
  for (const callMatch of analysis.matchAll(callPattern)) {
    const callStart = callMatch.index ?? 0;
    const openParenthesis = callStart + callMatch[0].lastIndexOf('(');
    const argumentStarts = [openParenthesis + 1];
    let parenthesisDepth = 1;
    let braceDepth = 0;
    let bracketDepth = 0;
    let closeParenthesis = -1;

    for (let index = openParenthesis + 1; index < analysis.length; index += 1) {
      const character = analysis[index];
      if (character === '(') parenthesisDepth += 1;
      else if (character === ')') {
        parenthesisDepth -= 1;
        if (parenthesisDepth === 0) {
          closeParenthesis = index;
          break;
        }
      } else if (character === '{') braceDepth += 1;
      else if (character === '}') braceDepth -= 1;
      else if (character === '[') bracketDepth += 1;
      else if (character === ']') bracketDepth -= 1;
      else if (
        character === ',' &&
        parenthesisDepth === 1 &&
        braceDepth === 0 &&
        bracketDepth === 0
      ) {
        argumentStarts.push(index + 1);
      }
    }

    if (closeParenthesis === -1 || argumentStarts.length <= argumentIndex) continue;
    const argumentStart = argumentStarts[argumentIndex] ?? closeParenthesis;
    const nextArgumentStart = argumentStarts[argumentIndex + 1];
    const argumentEnd = nextArgumentStart === undefined ? closeParenthesis : nextArgumentStart - 1;
    const argumentText = analysis.slice(argumentStart, argumentEnd);
    const leadingWhitespace = argumentText.match(/^\s*/u)?.[0].length ?? 0;
    const renderedValue = argumentText.trim();
    if (!new RegExp(String.raw`^${NUMERIC_EXPRESSION_PATTERN}$`, 'u').test(renderedValue)) continue;
    argumentsFound.push({
      label,
      offset: argumentStart + leadingWhitespace,
      renderedValue,
    });
  }
  return argumentsFound;
}

export function findWaitThresholdArguments(analysis: string): WaitThresholdArgument[] {
  return [
    ...findCallArgument(analysis, /\bBun\.sleep\s*\(/gu, 0, 'bun.sleep'),
    ...findCallArgument(
      analysis,
      /(?<![\w$.])(?:globalThis\.|window\.)?setTimeout\s*\(/gu,
      1,
      'setTimeout',
    ),
  ];
}

export function findBunTestTimeoutArguments(analysis: string): BunTestTimeoutArgument[] {
  const argumentsFound: BunTestTimeoutArgument[] = [];
  const callPattern = /\b(?:it|test)(?:\.(?!describe\b)[A-Za-z_$][\w$]*)*\s*\(/gu;
  for (const callMatch of analysis.matchAll(callPattern)) {
    const callStart = callMatch.index ?? 0;
    const openParenthesis = callStart + callMatch[0].lastIndexOf('(');
    const argumentStarts = [openParenthesis + 1];
    let parenthesisDepth = 1;
    let braceDepth = 0;
    let bracketDepth = 0;
    let closeParenthesis = -1;

    for (let index = openParenthesis + 1; index < analysis.length; index += 1) {
      const character = analysis[index];
      if (character === '(') parenthesisDepth += 1;
      else if (character === ')') {
        parenthesisDepth -= 1;
        if (parenthesisDepth === 0) {
          closeParenthesis = index;
          break;
        }
      } else if (character === '{') braceDepth += 1;
      else if (character === '}') braceDepth -= 1;
      else if (character === '[') bracketDepth += 1;
      else if (character === ']') bracketDepth -= 1;
      else if (
        character === ',' &&
        parenthesisDepth === 1 &&
        braceDepth === 0 &&
        bracketDepth === 0
      ) {
        argumentStarts.push(index + 1);
      }
    }

    if (closeParenthesis === -1 || argumentStarts.length < 3) continue;
    const timeoutStart = argumentStarts[2] ?? closeParenthesis;
    const timeoutText = analysis.slice(timeoutStart, closeParenthesis);
    const leadingWhitespace = timeoutText.match(/^\s*/u)?.[0].length ?? 0;
    const renderedValue = timeoutText.trim();
    if (!new RegExp(String.raw`^${NUMERIC_EXPRESSION_PATTERN}$`, 'u').test(renderedValue)) continue;
    argumentsFound.push({ offset: timeoutStart + leadingWhitespace, renderedValue });
  }
  return argumentsFound;
}
