import { describe, expect, test } from 'bun:test';
import { parseTerminalOutput, TerminalOutputParser } from './terminal-output-parser.ts';
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
    expect(parseTerminalOutput('old\u001b[2Knew')).toEqual([[{ text: '   new', bold: false }]]));
  test('erase to end preserves text before the cursor', () =>
    expect(parseTerminalOutput('old\u001b[0Knew')).toEqual([[{ text: 'oldnew', bold: false }]]));
  test('CSI sequences stop at their final byte and preserve later text', () =>
    expect(parseTerminalOutput('\u001b[31;foo m text')).toEqual([
      [{ text: 'oo m text', bold: false }],
    ]));
  test('consumes OSC-8 hyperlinks terminated by BEL or ST', () =>
    expect(
      parseTerminalOutput('before\u001b]8;;https://example.com\u0007linked\u001b]8;;\u001b\\after'),
    ).toEqual([[{ text: 'beforelinkedafter', bold: false }]]));
  test('consumes terminal-title OSC sequences terminated by BEL or ST', () =>
    expect(
      parseTerminalOutput('before\u001b]0;title\u0007middle\u001b]2;title\u001b\\after'),
    ).toEqual([[{ text: 'beforemiddleafter', bold: false }]]));
  test('consumes an unterminated OSC payload through the end of the input', () =>
    expect(parseTerminalOutput('before\u001b]8;;https://example.com')).toEqual([
      [{ text: 'before', bold: false }],
    ]));
  test('consumes extended 256-color and truecolor SGR parameters as one command', () =>
    expect(
      parseTerminalOutput('\u001b[31mred\u001b[38;5;196m still red \u001b[48;2;1;2;3m!'),
    ).toEqual([[{ text: 'red still red !', foreground: 1, bold: false }]]));
  test('erase-in-line 2 preserves the cursor column with blank cells', () =>
    expect(parseTerminalOutput('old\u001b[2Knew')).toEqual([[{ text: '   new', bold: false }]]));

  test('preserves incomplete control sequences across appended chunks', () => {
    const parser = new TerminalOutputParser();
    parser.append('before\u001b]8;;https://example.com');
    parser.append('\u0007linked\u001b[');
    parser.append('31m red');

    expect(parser.lines()).toEqual([
      [
        { text: 'beforelinked', bold: false },
        { text: ' red', foreground: 1, bold: false },
      ],
    ]);
  });
});
