import type { TerminalForeground, TerminalLine, TerminalTextRun } from './terminal-output.types.ts';
type Cell = { character: string; foreground?: TerminalForeground; bold: boolean };
const foregroundBySgrCode = new Map<number, TerminalForeground>([
  [30, 0],
  [31, 1],
  [32, 2],
  [33, 3],
  [34, 4],
  [35, 5],
  [36, 6],
  [37, 7],
  [90, 8],
  [91, 9],
  [92, 10],
  [93, 11],
  [94, 12],
  [95, 13],
  [96, 14],
  [97, 15],
]);
export function parseTerminalOutput(value: string): TerminalLine[] {
  const lines: Cell[][] = [[]];
  let line = 0;
  let column = 0;
  let foreground: TerminalForeground | undefined;
  let bold = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i]!;
    if ((c === '\u001b' && value[i + 1] === ']') || c === '\u009d') {
      const payloadStart = c === '\u009d' ? i + 1 : i + 2;
      let terminator = -1;
      let terminatorLength = 0;
      for (let candidate = payloadStart; candidate < value.length; candidate++) {
        if (value[candidate] === '\u0007') {
          terminator = candidate;
          terminatorLength = 1;
          break;
        }
        if (value[candidate] === '\u001b' && value[candidate + 1] === '\\') {
          terminator = candidate;
          terminatorLength = 2;
          break;
        }
      }
      // Unsupported OSC payloads (for example hyperlinks and terminal titles)
      // are inert. An incomplete sequence consumes the remainder as payload.
      i = terminator >= 0 ? terminator + terminatorLength - 1 : value.length;
      continue;
    }
    if (c === '\u001b' && value[i + 1] === '[') {
      let end = -1;
      for (let candidate = i + 2; candidate < value.length; candidate++) {
        const code = value.charCodeAt(candidate);
        if (code >= 0x40 && code <= 0x7e) {
          end = candidate;
          break;
        }
      }
      if (end >= 0) {
        const command = value.slice(i + 2, end);
        if (value[end] === 'K' && (command === '' || command === '0' || command === '2')) {
          if (command === '2') lines[line] = [];
          else lines[line]?.splice(column);
        }
        if (value[end] === 'm')
          for (const code of (command || '0').split(';').map(Number)) {
            if (code === 0) {
              foreground = undefined;
              bold = false;
            } else if (code === 1) bold = true;
            else if (code === 22) bold = false;
            else if (code === 39) foreground = undefined;
            else if (foregroundBySgrCode.has(code)) foreground = foregroundBySgrCode.get(code);
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
    const currentLine = lines[line] ?? (lines[line] = []);
    currentLine[column++] = {
      character: c,
      ...(foreground === undefined ? {} : { foreground }),
      bold,
    };
  }
  return lines.map((cells) => {
    const runs: TerminalTextRun[] = [];
    for (const cell of cells) {
      if (!cell) continue;
      const prev = runs.at(-1);
      if (prev && prev.foreground === cell.foreground && prev.bold === cell.bold)
        prev.text += cell.character;
      else
        runs.push({
          text: cell.character,
          ...(cell.foreground === undefined ? {} : { foreground: cell.foreground }),
          bold: cell.bold,
        });
    }
    return runs;
  });
}
