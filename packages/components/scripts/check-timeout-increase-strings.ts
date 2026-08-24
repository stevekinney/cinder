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
    if (character === '"' || character === "'") {
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
  return line.replace(
    /(?<quote>['"])(?<key>[A-Za-z_$][\w$-]*)\k<quote>(?=\s*:)/gu,
    (_match, _quote: string, key: string) => key,
  );
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
    return lines.map(stripUnquotedHashComment);
  }
  return [...lines];
}

export function isTestOrValidationInfrastructure(filePath: string, analysis = ''): boolean {
  return (
    /(?:^|\/)(?:scripts|tests?|testing)(?:\/|$)|(?:\.(?:spec|test)\.|_(?:spec|test)_)[^/]+$/u.test(
      filePath,
    ) ||
    /(?:^|\/)(?:check|validate)-[^/]+\.[^/]+$/u.test(filePath) ||
    /(?:^|\/)(?:jest|playwright|vitest)\.config\.[^/]+$/u.test(filePath) ||
    /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(filePath) ||
    /(?:^|\/)bunfig\.toml$/u.test(filePath) ||
    /\btest\.describe\.configure\s*\(/u.test(analysis)
  );
}

export function isTestThresholdAssignment(
  filePath: string,
  analysis: string,
  label: string,
): boolean {
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel === 'timeout-minutes') return true;
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

export function normalizeWorkflowExpressions(filePath: string, analysis: string): string {
  if (!/^\.github\/workflows\/[^/]+\.ya?ml$/u.test(filePath)) return analysis;
  return analysis.replace(/\$\{\{\s*(\d[\d_.]*)\s*\}\}/gu, '$1');
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
    /^--(?<label>timeout-minutes|timeout|test-timeout|retries|retry|rerun-each|slow)$/iu;
  const exactPattern = new RegExp(
    String.raw`^--(?<label>timeout-minutes|timeout|test-timeout|retries|retry|rerun-each|slow)=(?<value>${NUMERIC_EXPRESSION_PATTERN})$`,
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
        label: flagMatch.groups?.['label'] ?? '',
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
    /^\s*['"]--(?<label>timeout-minutes|timeout|test-timeout|retries|retry|rerun-each|slow)['"]\s*,?\s*$/iu;
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
      label: flagMatch.groups?.['label'] ?? '',
      renderedValue: valueMatch.groups?.['value'] ?? '',
      lineIndex: valueLineIndex,
    });
  }
  return results;
}
