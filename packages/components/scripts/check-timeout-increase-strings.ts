import { extname } from 'node:path';

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
    const strippedLines = stripQuotedTextLines(lines.map(exposeQuotedConfigurationKeys));
    return strippedLines.map((line, index) =>
      extension === '.svelte' && /^\s*</u.test(lines[index] ?? '')
        ? ''
        : line.replace(/(?:\/\/|\/\*).*$/u, ''),
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
