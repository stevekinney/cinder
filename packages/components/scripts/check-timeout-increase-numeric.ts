const NON_DECIMAL_NUMERIC_LITERAL_PATTERN = String.raw`(?:0[xX][\dA-Fa-f][\dA-Fa-f_]*|0[bB][01][01_]*|0[oO][0-7][0-7_]*)`;
const DECIMAL_NUMERIC_LITERAL_PATTERN = String.raw`\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?`;
const NUMERIC_LITERAL_PATTERN = String.raw`(?:${NON_DECIMAL_NUMERIC_LITERAL_PATTERN}|${DECIMAL_NUMERIC_LITERAL_PATTERN})`;
const FLAT_NUMERIC_EXPRESSION_PATTERN = String.raw`${NUMERIC_LITERAL_PATTERN}(?:\s*[*/+-]\s*${NUMERIC_LITERAL_PATTERN})*`;
const NUMERIC_ATOM_PATTERN = String.raw`(?:${NUMERIC_LITERAL_PATTERN}|\(\s*${FLAT_NUMERIC_EXPRESSION_PATTERN}\s*\))`;

export const NUMERIC_EXPRESSION_PATTERN = String.raw`${NUMERIC_ATOM_PATTERN}(?:\s*[*/+-]\s*${NUMERIC_ATOM_PATTERN})*`;

export function parseNumericLiteral(literal: string): number {
  const normalized = literal.replaceAll('_', '').replace(/\s+/gu, '');
  const tokens = normalized.match(
    /0[xX][\dA-Fa-f]+|0[bB][01]+|0[oO][0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[()*/+-]/gu,
  );
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
  const normalizedLabel = label.toLowerCase();
  if (label.toLowerCase() !== 'timeout-minutes') {
    if (/(?:hours?|hrs?)$/iu.test(label)) return value * 3_600_000;
    if (/(?:minutes?|mins?)$/iu.test(label)) return value * 60_000;
    if (/(?:milliseconds?|msecs?|ms)$/iu.test(label)) return value;
    if (/(?:seconds?|secs?)$/iu.test(label)) return value * 1_000;
  }
  if (normalizedLabel === 'sleep' || normalizedLabel === 'shell.timeout') {
    const unit =
      /\b(?:sleep|timeout)\s+\d[\d_.]*(?<unit>[smhd])?(?![\w.])/u.exec(line)?.groups?.['unit'] ??
      's';
    return value * ({ s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 1_000);
  }
  if (value !== 0) return value;
  if (/(?:poll|interval|delay)/u.test(normalizedLabel)) return value;
  if (
    normalizedLabel.includes('press') ||
    normalizedLabel.includes('retr') ||
    normalizedLabel.includes('slow')
  ) {
    return value;
  }
  if (
    [
      'abortsignal.timeout',
      'bun.sleep',
      'bun.sleepsync',
      'fetchwithtimeout',
      'promisewithtimeout',
      'waitfortimeout',
      'waitforurl',
    ].includes(normalizedLabel)
  ) {
    return value;
  }
  if (normalizedLabel === 'settimeout' && !/\btest\.setTimeout\s*\(/u.test(line)) return value;
  return Number.POSITIVE_INFINITY;
}

export type BunTestTimeoutArgument = {
  offset: number;
  renderedValue: string;
};

export type WaitThresholdArgument = BunTestTimeoutArgument & {
  label:
    | 'bun.sleep'
    | 'bun.sleepSync'
    | 'expect.poll.intervals'
    | 'fetchWithTimeout'
    | 'promiseWithTimeout'
    | 'setTimeout'
    | 'waitForTimeout'
    | 'waitForUrl';
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
    ...findCallArgument(analysis, /\bBun\.sleepSync\s*\(/gu, 0, 'bun.sleepSync'),
    ...findCallArgument(
      analysis,
      /(?<![\w$.])(?:globalThis\.|window\.)?setTimeout\s*\(/gu,
      1,
      'setTimeout',
    ),
    ...findCallArgument(analysis, /\bwaitForUrl\s*\(/gu, 1, 'waitForUrl'),
    ...findCallArgument(analysis, /\bfetchWithTimeout\s*\(/gu, 1, 'fetchWithTimeout'),
    ...findCallArgument(analysis, /\bpromiseWithTimeout\s*\(/gu, 1, 'promiseWithTimeout'),
    ...findPlaywrightExpectPollIntervals(analysis),
  ];
}

function findPlaywrightExpectPollIntervals(analysis: string): WaitThresholdArgument[] {
  const argumentsFound: WaitThresholdArgument[] = [];
  const pattern = new RegExp(
    String.raw`\bexpect\.poll\s*\([\s\S]*?\bintervals\s*:\s*\[(?<values>[^\]]*)\]`,
    'gu',
  );
  const valuePattern = new RegExp(NUMERIC_EXPRESSION_PATTERN, 'gu');
  for (const match of analysis.matchAll(pattern)) {
    const values = match.groups?.['values'];
    if (values === undefined) continue;
    const valuesStart = (match.index ?? 0) + match[0].lastIndexOf(values);
    for (const valueMatch of values.matchAll(valuePattern)) {
      argumentsFound.push({
        label: 'expect.poll.intervals',
        offset: valuesStart + (valueMatch.index ?? 0),
        renderedValue: valueMatch[0],
      });
    }
  }
  return argumentsFound;
}

export function findWaitThresholdBounds(analysis: string): WaitThresholdArgument[] {
  const bounds: WaitThresholdArgument[] = [];
  const callPattern =
    /\b(?<label>Bun\.sleep(?:Sync)?|waitForTimeout|waitForUrl|fetchWithTimeout|promiseWithTimeout)\s*\([\s\S]*?\bMath\.(?:min|max)\s*\(\s*(?<value>\d[\d_]*(?:\.\d[\d_]*)?)/gu;
  for (const match of analysis.matchAll(callPattern)) {
    const renderedValue = match.groups?.['value'];
    const label = match.groups?.['label'];
    let thresholdLabel: WaitThresholdArgument['label'];
    switch (label) {
      case 'Bun.sleep':
        thresholdLabel = 'bun.sleep';
        break;
      case 'Bun.sleepSync':
        thresholdLabel = 'bun.sleepSync';
        break;
      case 'fetchWithTimeout':
      case 'promiseWithTimeout':
      case 'waitForTimeout':
      case 'waitForUrl':
        thresholdLabel = label;
        break;
      default:
        continue;
    }
    if (renderedValue === undefined) continue;
    bounds.push({
      label: thresholdLabel,
      offset: (match.index ?? 0) + match[0].lastIndexOf(renderedValue),
      renderedValue,
    });
  }
  return bounds;
}

export function findPromiseTimerAliasArguments(analysis: string): WaitThresholdArgument[] {
  const argumentsFound: WaitThresholdArgument[] = [];
  const aliases = new Set<string>();
  for (const match of analysis.matchAll(
    /\bimport\s*\{[^}]*\bsetTimeout\s+as\s+(?<alias>[A-Za-z_$][\w$]*)[^}]*\}\s*from\b/gu,
  )) {
    const alias = match.groups?.['alias'];
    if (alias !== undefined) aliases.add(alias);
  }
  for (const alias of aliases) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    argumentsFound.push(
      ...findCallArgument(
        analysis,
        new RegExp(String.raw`\b${escapedAlias}\s*\(`, 'gu'),
        0,
        'setTimeout',
      ),
    );
  }
  return argumentsFound;
}

export function findBunTestTimeoutArguments(analysis: string): BunTestTimeoutArgument[] {
  const argumentsFound: BunTestTimeoutArgument[] = [];
  const callPattern =
    /\b(?:(?:it|test)\.(?:each|runIf|skipIf|todoIf)\s*\([^()]*(?:\([^()]*\)[^()]*)*\)\s*\(|(?:it|test)(?:\.(?!describe\b|each\b)[A-Za-z_$][\w$]*)*\s*\()/gu;
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

export function findBunLifecycleTimeoutArguments(analysis: string): BunTestTimeoutArgument[] {
  return findCallArgument(
    analysis,
    /\b(?:afterAll|afterEach|beforeAll|beforeEach)\s*\(/gu,
    1,
    'setTimeout',
  ).map(({ offset, renderedValue }) => ({ offset, renderedValue }));
}

export function findPlaywrightRelativeTimeoutExtensions(
  analysis: string,
): BunTestTimeoutArgument[] {
  const extensions: BunTestTimeoutArgument[] = [];
  const pattern = new RegExp(
    String.raw`\btestInfo\.setTimeout\s*\(\s*testInfo\.timeout\s*\+\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'gu',
  );
  for (const match of analysis.matchAll(pattern)) {
    const renderedValue = match.groups?.['value'];
    if (renderedValue === undefined) continue;
    const valueOffset = match[0].lastIndexOf(renderedValue);
    extensions.push({ offset: (match.index ?? 0) + valueOffset, renderedValue });
  }
  return extensions;
}
