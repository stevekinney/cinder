import { describe, expect, test } from 'bun:test';
import { parseTerminalOutput } from './terminal-output-parser.ts';
describe('parseTerminalOutput', () => {
  test('parses SGR colors and reset', () =>
    expect(parseTerminalOutput('\u001b[31mred\u001b[0m plain')).toEqual([
      [
        { text: 'red', foreground: 1, bold: false },
        { text: ' plain', bold: false },
      ],
    ]));
  test('rewrites carriage-return lines', () =>
    expect(parseTerminalOutput('old\rnew')).toEqual([[{ text: 'new', bold: false }]]));
  test('erases the current line', () =>
    expect(parseTerminalOutput('old\u001b[2Knew')).toEqual([[{ text: 'new', bold: false }]]));
});
