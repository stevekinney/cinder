export function stripQuotedText(line: string): string {
  let quote: '"' | "'" | '`' | undefined;
  let escaped = false;
  return Array.from(line)
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
    .join('');
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
