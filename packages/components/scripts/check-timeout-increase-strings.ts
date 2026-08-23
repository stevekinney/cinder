import { extname } from 'node:path';

import { NUMERIC_EXPRESSION_PATTERN } from './check-timeout-increase-numeric';

type Quote = '"' | "'" | '`';

export function stripQuotedTextLines(lines: readonly string[]): string[] {
  let quote: Quote | undefined;
  let escaped = false;
  return lines.map((line) =>
    Array.from(line)
      .map((character) => {
        if (quote === undefined) {
          if (character === '"' || character === "'" || character === '`') {
            quote = character;
            return ' ';
          }
          return character;
        }
        if (escaped) {
          escaped = false;
          return ' ';
        }
        if (character === '\\') {
          escaped = true;
          return ' ';
        }
        if (character === quote) quote = undefined;
        return ' ';
      })
      .join(''),
  );
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
      }
    }
    return output.join('');
  });
}

export function isCommentOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length === 0 ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('<!--')
  );
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
  if (['.cjs', '.js', '.jsx', '.mjs', '.svelte', '.ts', '.tsx'].includes(extension)) {
    const uncommentedLines = stripJavaScriptCommentsLines(lines);
    const strippedLines = stripQuotedTextLines(uncommentedLines.map(exposeQuotedConfigurationKeys));
    return strippedLines.map((line, index) =>
      extension === '.svelte' && /^\s*</u.test(lines[index] ?? '') ? '' : line,
    );
  }
  if (['.bash', '.sh', '.yaml', '.yml', '.zsh'].includes(extension)) {
    return lines.map(stripUnquotedHashComment);
  }
  return [...lines];
}

export function sourceLineForAnalysis(filePath: string, line: string): string {
  return sourceLinesForAnalysis(filePath, [line])[0] ?? '';
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
  label: string;
  renderedValue: string;
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
        label: flagMatch.groups?.['label'] ?? '',
        renderedValue: splitValue,
      });
    }
  }
  return results;
}
