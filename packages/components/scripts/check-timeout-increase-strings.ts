import { extname } from 'node:path';

import { NUMERIC_EXPRESSION_PATTERN } from './check-timeout-increase-numeric';

type Quote = '"' | "'" | '`';

export function stripQuotedTextLines(lines: readonly string[]): string[] {
  let quote: Quote | undefined;
  let escaped = false;
  let templateExpressionDepth = 0;
  return lines.map((line) => {
    const output = Array.from(line);
    for (let index = 0; index < output.length; index += 1) {
      const character = output[index] ?? '';
      const nextCharacter = output[index + 1] ?? '';
      if (quote === '`' && character === '$' && nextCharacter === '{' && !escaped) {
        output[index] = ' ';
        output[index + 1] = ' ';
        quote = undefined;
        templateExpressionDepth = 1;
        index += 1;
        continue;
      }
      if (quote !== undefined) {
        output[index] = ' ';
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = undefined;
        continue;
      }
      if (templateExpressionDepth > 0) {
        if (character === '{') templateExpressionDepth += 1;
        else if (character === '}') {
          templateExpressionDepth -= 1;
          if (templateExpressionDepth === 0) {
            output[index] = ' ';
            quote = '`';
          }
        } else if (character === '"' || character === "'") {
          quote = character;
          output[index] = ' ';
        }
        continue;
      }
      if (character === '"' || character === "'" || character === '`') {
        quote = character;
        output[index] = ' ';
      }
    }
    return output.join('');
  });
}

export function stripQuotedText(line: string): string {
  return stripQuotedTextLines([line])[0] ?? '';
}

function stripJavaScriptCommentsLines(lines: readonly string[]): string[] {
  let blockComment = false;
  let quote: Quote | undefined;
  let escaped = false;
  return lines.map((line) => {
    const output = Array.from(line);
    let regularExpression = false;
    let regularExpressionCharacterClass = false;
    for (let index = 0; index < output.length; index += 1) {
      const character = output[index] ?? '';
      const nextCharacter = output[index + 1] ?? '';
      if (blockComment) {
        output[index] = ' ';
        if (character === '*' && nextCharacter === '/') {
          output[index + 1] = ' ';
          blockComment = false;
          index += 1;
        }
        continue;
      }
      if (regularExpression) {
        output[index] = ' ';
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '[') regularExpressionCharacterClass = true;
        else if (character === ']') regularExpressionCharacterClass = false;
        else if (character === '/' && !regularExpressionCharacterClass) regularExpression = false;
        continue;
      }
      if (quote !== undefined) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = undefined;
        continue;
      }
      if (character === '"' || character === "'" || character === '`') {
        quote = character;
        continue;
      }
      if (character === '/' && nextCharacter === '/') {
        output.fill(' ', index);
        break;
      }
      if (character === '/' && nextCharacter === '*') {
        output[index] = ' ';
        output[index + 1] = ' ';
        blockComment = true;
        index += 1;
        continue;
      }
      if (character === '/' && canStartJavaScriptRegularExpression(line, index)) {
        output[index] = ' ';
        regularExpression = true;
        regularExpressionCharacterClass = false;
      }
    }
    return output.join('');
  });
}

function canStartJavaScriptRegularExpression(line: string, slashIndex: number): boolean {
  const prefix = line.slice(0, slashIndex).trimEnd();
  if (prefix.length === 0) return true;
  if (
    /(?:^|[^\w$])(?:await|case|delete|do|else|in|instanceof|of|return|throw|typeof|void|yield)$/u.test(
      prefix,
    )
  ) {
    return true;
  }
  return /[([{=,:;!?&|+\-*%^~<>]$/u.test(prefix);
}

function stripUnquotedHashComment(line: string): string {
  let quote: '"' | "'" | '`' | undefined;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote !== undefined) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '#' && (index === 0 || /\s/u.test(line[index - 1] ?? ''))) {
      return line.slice(0, index);
    }
  }
  return line;
}

function exposeQuotedConfigurationKeys(line: string): string {
  const output = Array.from(line);
  for (let index = 0; index < output.length; index += 1) {
    const quote = output[index];
    if (quote !== '"' && quote !== "'") continue;
    let escaped = false;
    let closingIndex = index + 1;
    for (; closingIndex < output.length; closingIndex += 1) {
      const character = output[closingIndex] ?? '';
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        break;
      }
    }
    if (closingIndex >= output.length) break;
    const key = line.slice(index + 1, closingIndex);
    if (key === 'node:timers/promises' && /\bfrom\s*$/u.test(line.slice(0, index))) {
      output[index] = ' ';
      output[closingIndex] = ' ';
      index = closingIndex;
      continue;
    }
    if (!/^[A-Za-z_$][\w$-]*$/u.test(key)) {
      index = closingIndex;
      continue;
    }
    let nextIndex = closingIndex + 1;
    while (/\s/u.test(output[nextIndex] ?? '')) nextIndex += 1;
    if (output[nextIndex] !== ':') {
      index = closingIndex;
      continue;
    }
    output[index] = ' ';
    output[closingIndex] = ' ';
    index = closingIndex;
  }
  return output.join('');
}

export function sourceLinesForAnalysis(filePath: string, lines: readonly string[]): string[] {
  const extension = extname(filePath);
  if (
    ['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.svelte', '.ts', '.tsx'].includes(extension)
  ) {
    const uncommentedLines = stripJavaScriptCommentsLines(lines);
    const strippedLines = stripQuotedTextLines(uncommentedLines.map(exposeQuotedConfigurationKeys));
    return strippedLines.map((line, index) => {
      if (/^\s*#/u.test(line)) return '';
      return extension === '.svelte' && /^\s*</u.test(lines[index] ?? '') ? '' : line;
    });
  }
  if (['.bash', '.sh', '.toml', '.yaml', '.yml', '.zsh'].includes(extension)) {
    return lines.map((line) => exposeQuotedConfigurationKeys(stripUnquotedHashComment(line)));
  }
  if (extension === '.json') {
    return lines.map(exposeQuotedConfigurationKeys);
  }
  return [...lines];
}

export function isTestOrValidationInfrastructure(filePath: string, analysis = ''): boolean {
  return (
    /(?:^|\/)(?:scripts|tests?|testing)(?:\/|$)|(?:\.(?:spec|test)\.|_(?:spec|test)_)[^/]+$/u.test(
      filePath,
    ) ||
    /(?:^|\/)\.husky\/[^/]+$/u.test(filePath) ||
    /(?:^|\/)(?:check|validate)-[^/]+\.[^/]+$/u.test(filePath) ||
    /(?:^|\/)(?:jest|playwright|vitest)\.config\.[^/]+$/u.test(filePath) ||
    (extensionIsJson(filePath) && /\bjest\s*:/u.test(analysis)) ||
    /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(filePath) ||
    /(?:^|\/)bunfig\.toml$/u.test(filePath) ||
    /\btest\.describe\.configure\s*\(/u.test(analysis)
  );
}

function extensionIsJson(filePath: string): boolean {
  return extname(filePath) === '.json';
}

export function isTestThresholdAssignment(
  filePath: string,
  analysis: string,
  label: string,
): boolean {
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel === 'timeout-minutes') return true;
  if (normalizedLabel === 'repeateach') {
    return /(?:^|\/)playwright\.config\.[^/]+$/u.test(filePath);
  }
  if (normalizedLabel === 'timeout' && /(?:^|\/)bunfig\.toml$/u.test(filePath)) return true;
  if (normalizedLabel === 'retry' || normalizedLabel === 'retries') {
    return (
      /(?:^|\/)(?:jest|playwright|vitest)\.config\.[^/]+$/u.test(filePath) ||
      /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(filePath) ||
      /\btest\.describe\.configure\s*\(/u.test(analysis)
    );
  }
  return isTestOrValidationInfrastructure(filePath, analysis);
}

export function sourceLineForAnalysis(filePath: string, line: string): string {
  return sourceLinesForAnalysis(filePath, [line])[0] ?? '';
}

export function isExecutableConfigurationCliLine(
  filePath: string,
  line: string,
  analysisBeforeLine: string,
): boolean {
  const extension = extname(filePath);
  if (!['.json', '.yaml', '.yml'].includes(extension)) return true;
  const executablePattern =
    /\b(?:bun|bunx|gh|jest|node|npx|npm|playwright|pnpm|vitest|yarn)\b[^\n"']*(?:--[\w-]+|-i\b)/u;
  if (executablePattern.test(line)) return true;
  const precedingLine = analysisBeforeLine.split('\n').findLast((entry) => entry.trim().length > 0);
  return precedingLine !== undefined && /\\\s*$/u.test(precedingLine)
    ? executablePattern.test(`${precedingLine}\n${line}`.replace('\\\n', ' '))
    : false;
}

export function normalizeWorkflowExpressions(filePath: string, analysis: string): string {
  if (!/^\.github\/workflows\/[^/]+\.ya?ml$/u.test(filePath)) return analysis;
  return analysis
    .replace(/\$\{\{[^{}\n]*?(?:\|\||\?\?)\s*(?<fallback>\d[\d_.]*)\s*\}\}/gu, '$<fallback>')
    .replace(/\$\{\{\s*(\d[\d_.]*)\s*\}\}/gu, '$1');
}

export function shellContinuationContext(analysisBeforeLine: string, line: string): string {
  const lines = analysisBeforeLine.split('\n');
  let startIndex = lines.length - 1;
  if (!lines[startIndex]?.trimEnd().endsWith('\\')) return line;
  while (startIndex > 0 && lines[startIndex - 1]?.trimEnd().endsWith('\\')) startIndex -= 1;
  return `${lines.slice(startIndex).join('\n')}\n${line}`;
}

export function extractTopLevelQuotedStrings(line: string): string[] {
  const values: string[] = [];
  let quote: '"' | "'" | undefined;
  let escaped = false;
  let value = '';
  for (const character of line) {
    if (quote === undefined) {
      if (character === '"' || character === "'") quote = character;
      continue;
    }
    if (escaped) {
      value += character;
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === quote) {
      values.push(value);
      quote = undefined;
      value = '';
    } else {
      value += character;
    }
  }
  return values;
}

export type ExecutableCliThresholdArgument = {
  bunTestCommand: boolean;
  label: string;
  renderedValue: string;
};

export type MultilineExecutableCliThresholdArgument = ExecutableCliThresholdArgument & {
  lineIndex: number;
};

export type ShellWaitThresholdArgument = {
  label: 'shell.kill-after' | 'shell.timeout' | 'sleep';
  offset: number;
  renderedValue: string;
  sourceText: string;
};

export function extractShellWaitThresholdArguments(analysis: string): ShellWaitThresholdArgument[] {
  const duration = String.raw`(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]*)(?:[smhd])?`;
  const timeoutOption = String.raw`(?:(?:--foreground|--preserve-status|--verbose)\s+|(?:--signal(?:=|\s+)|-s\s+)\S+\s+)`;
  const pattern = new RegExp(
    String.raw`(?:^|(?:&&|[;&|])\s*|\n\s*|\brun:\s*)(?<command>sleep|timeout)\s+(?:${timeoutOption})*(?:(?:-k\s+|--kill-after(?:=|\s+))(?<killAfter>${duration})\s+)?(?:${timeoutOption})*(?<value>${duration})(?![\w.])`,
    'gu',
  );
  return [...analysis.matchAll(pattern)].flatMap((match) => {
    const command = match.groups?.['command'];
    const value = match.groups?.['value'];
    if (command === undefined || value === undefined) return [];
    const sourceText = match[0];
    const offset = match.index ?? 0;
    const main: ShellWaitThresholdArgument = {
      label: command === 'timeout' ? 'shell.timeout' : 'sleep',
      offset,
      renderedValue: value.replace(/[smhd]$/u, ''),
      sourceText,
    };
    const killAfter = match.groups?.['killAfter'];
    return killAfter === undefined
      ? [main]
      : [
          {
            label: 'shell.kill-after',
            offset,
            renderedValue: killAfter.replace(/[smhd]$/u, ''),
            sourceText,
          },
          main,
        ];
  });
}

function isExecutableCliArgumentLine(line: string, argument: string): boolean {
  for (const quotedArgument of [`'${argument}'`, `"${argument}"`]) {
    const argumentIndex = line.indexOf(quotedArgument);
    if (argumentIndex === -1) continue;
    const prefix = line.slice(0, argumentIndex).trimEnd();
    if (prefix.length === 0 || prefix.endsWith('[') || prefix.endsWith(',')) return true;
  }
  return false;
}

export function extractExecutableCliThresholdArguments(
  line: string,
): ExecutableCliThresholdArgument[] {
  const results: ExecutableCliThresholdArgument[] = [];
  const argumentsFound = extractTopLevelQuotedStrings(line);
  const bunTestCommand = argumentsFound.some(
    (argument, index) => argument === 'bun' && argumentsFound[index + 1] === 'test',
  );
  const flagPattern =
    /^(?:--(?<label>timeout-minutes|timeout|test-timeout|testTimeout|retries|retry|repeat-each|rerun-each|slow|interval)|(?<shortLabel>-i))$/iu;
  const exactPattern = new RegExp(
    String.raw`^--(?<label>timeout-minutes|timeout|test-timeout|testTimeout|retries|retry|repeat-each|rerun-each|slow|interval)=(?<value>${NUMERIC_EXPRESSION_PATTERN})$`,
    'iu',
  );
  const numericPattern = new RegExp(String.raw`^${NUMERIC_EXPRESSION_PATTERN}$`, 'u');

  for (const [argumentIndex, argument] of argumentsFound.entries()) {
    if (!isExecutableCliArgumentLine(line, argument)) continue;
    const exactMatch = exactPattern.exec(argument);
    if (exactMatch !== null) {
      results.push({
        bunTestCommand,
        label: exactMatch.groups?.['label'] ?? '',
        renderedValue: exactMatch.groups?.['value'] ?? '',
      });
    }

    const flagMatch = flagPattern.exec(argument);
    const splitValue = argumentsFound[argumentIndex + 1];
    if (
      flagMatch !== null &&
      splitValue !== undefined &&
      numericPattern.test(splitValue) &&
      isExecutableCliArgumentLine(line, splitValue)
    ) {
      results.push({
        bunTestCommand,
        label: flagMatch.groups?.['label'] ?? (flagMatch.groups?.['shortLabel'] ? 'interval' : ''),
        renderedValue: splitValue,
      });
    }
  }
  return results;
}

function findContainingArrayStart(lines: readonly string[], lineIndex: number): number | undefined {
  for (let index = lineIndex - 1; index >= 0; index -= 1) {
    const analysis = stripQuotedText(lines[index] ?? '');
    if (analysis.includes(']')) return undefined;
    if (analysis.includes('[')) return index;
  }
  return undefined;
}

export function extractMultilineExecutableCliThresholdArguments(
  lines: readonly string[],
): MultilineExecutableCliThresholdArgument[] {
  const results: MultilineExecutableCliThresholdArgument[] = [];
  const flagPattern =
    /^\s*['"](?:--(?<label>timeout-minutes|timeout|test-timeout|testTimeout|retries|retry|repeat-each|rerun-each|slow|interval)|(?<shortLabel>-i))['"]\s*,?\s*$/iu;
  const valuePattern = new RegExp(
    String.raw`^\s*['"](?<value>${NUMERIC_EXPRESSION_PATTERN})['"]\s*,?\s*$`,
    'u',
  );

  for (const [lineIndex, line] of lines.entries()) {
    const flagMatch = flagPattern.exec(line);
    const arrayStartIndex = findContainingArrayStart(lines, lineIndex);
    if (flagMatch === null || arrayStartIndex === undefined) continue;
    let valueLineIndex = lineIndex + 1;
    while (valueLineIndex < lines.length && (lines[valueLineIndex] ?? '').trim().length === 0) {
      valueLineIndex += 1;
    }
    const valueMatch = valuePattern.exec(lines[valueLineIndex] ?? '');
    if (valueMatch === null) continue;
    const precedingArguments = lines
      .slice(arrayStartIndex, lineIndex)
      .flatMap(extractTopLevelQuotedStrings);
    const bunTestCommand = precedingArguments.some(
      (argument, index) => argument === 'bun' && precedingArguments[index + 1] === 'test',
    );
    results.push({
      bunTestCommand,
      label: flagMatch.groups?.['label'] ?? (flagMatch.groups?.['shortLabel'] ? 'interval' : ''),
      renderedValue: valueMatch.groups?.['value'] ?? '',
      lineIndex: valueLineIndex,
    });
  }
  return results;
}
