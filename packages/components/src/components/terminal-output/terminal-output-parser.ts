import type { TerminalForeground, TerminalLine, TerminalTextRun } from './terminal-output.types.ts';
type Cell = { character: string; foreground?: TerminalForeground; bold?: boolean };
export function parseTerminalOutput(value: string): TerminalLine[] {
  const lines: Cell[][] = [[]];
  let line = 0;
  let column = 0;
  let foreground: TerminalForeground | undefined;
  let bold = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i]!;
    if (c === '\u001b' && value[i + 1] === '[') {
      const m = value.indexOf('m', i + 2),
        k = value.indexOf('K', i + 2),
        end = m >= 0 && (k < 0 || m < k) ? m : k;
      if (end >= 0) {
        const command = value.slice(i + 2, end);
        if (value[end] === 'K' && (command === '' || command === '0' || command === '2'))
          lines[line] = [];
        if (value[end] === 'm')
          for (const code of (command || '0').split(';').map(Number)) {
            if (code === 0) {
              foreground = undefined;
              bold = false;
            } else if (code === 1) bold = true;
            else if (code === 22) bold = false;
            else if (code === 39) foreground = undefined;
            else if (code >= 30 && code <= 37) foreground = (code - 30) as TerminalForeground;
            else if (code >= 90 && code <= 97) foreground = (code - 82) as TerminalForeground;
          }
        i = end;
        continue;
      }
    }
    if (c === '\r') {
      column = 0;
      continue;
    }
    if (c === '\n') {
      line++;
      lines[line] = [];
      column = 0;
      continue;
    }
    lines[line][column++] = { character: c, foreground, bold };
  }
  return lines.map((cells) => {
    const runs: TerminalTextRun[] = [];
    for (const cell of cells) {
      if (!cell) continue;
      const prev = runs.at(-1);
      if (prev && prev.foreground === cell.foreground && prev.bold === cell.bold)
        prev.text += cell.character;
      else runs.push({ text: cell.character, foreground: cell.foreground, bold: cell.bold });
    }
    return runs;
  });
}
