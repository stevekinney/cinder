import type { TerminalForeground, TerminalLine, TerminalTextRun } from './terminal-output.types.ts';

type Cell = { character: string; foreground?: TerminalForeground; bold: boolean };
const colors = new Map<number, TerminalForeground>([
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

function toLines(lines: Cell[][]): TerminalLine[] {
  return lines.map((cells) => {
    const runs: TerminalTextRun[] = [];
    for (const cell of cells) {
      const previous = runs.at(-1);
      if (previous && previous.foreground === cell.foreground && previous.bold === cell.bold)
        previous.text += cell.character;
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

export class TerminalOutputParser {
  #lines: Cell[][] = [[]];
  #line = 0;
  #column = 0;
  #foreground: TerminalForeground | undefined;
  #bold = false;
  #pending = '';

  reset(): void {
    this.#lines = [[]];
    this.#line = 0;
    this.#column = 0;
    this.#foreground = undefined;
    this.#bold = false;
    this.#pending = '';
  }

  append(value: string): void {
    const input = this.#pending + value;
    this.#pending = '';
    for (let index = 0; index < input.length; index += 1) {
      const character = input[index]!;
      if ((character === '\u001b' && input[index + 1] === ']') || character === '\u009d') {
        const payloadStart = character === '\u009d' ? index + 1 : index + 2;
        let end = -1;
        for (let candidate = payloadStart; candidate < input.length; candidate += 1) {
          if (input[candidate] === '\u0007') {
            end = candidate + 1;
            break;
          }
          if (input[candidate] === '\u001b' && input[candidate + 1] === '\\') {
            end = candidate + 2;
            break;
          }
        }
        if (end < 0) {
          this.#pending = input.slice(index);
          break;
        }
        index = end - 1;
        continue;
      }
      if (character === '\u001b' && input[index + 1] === '[') {
        let end = -1;
        for (let candidate = index + 2; candidate < input.length; candidate += 1) {
          const code = input.charCodeAt(candidate);
          if (code >= 0x40 && code <= 0x7e) {
            end = candidate;
            break;
          }
        }
        if (end < 0) {
          this.#pending = input.slice(index);
          break;
        }
        if (end >= 0) {
          const command = input.slice(index + 2, end);
          if (input[end] === 'K' && (command === '' || command === '0' || command === '2')) {
            if (command === '2') {
              const length = Math.max(this.#column, this.#lines[this.#line]?.length ?? 0);
              this.#lines[this.#line] = Array.from({ length }, () => this.blankCell());
            } else this.#lines[this.#line]?.splice(this.#column);
          }
          if (input[end] === 'm') this.applySgr(command || '0');
          index = end;
          continue;
        }
      }
      if (character === '\u001b' && index === input.length - 1) {
        this.#pending = character;
        break;
      }
      if (character === '\r') {
        this.#column = 0;
        continue;
      }
      if (character === '\n') {
        this.#line += 1;
        this.#lines[this.#line] = [];
        this.#column = 0;
        continue;
      }
      const line = this.#lines[this.#line] ?? (this.#lines[this.#line] = []);
      line[this.#column++] = {
        character,
        ...(this.#foreground === undefined ? {} : { foreground: this.#foreground }),
        bold: this.#bold,
      };
    }
  }

  lines(): TerminalLine[] {
    return toLines(this.#lines);
  }

  private blankCell(): Cell {
    return {
      character: ' ',
      ...(this.#foreground === undefined ? {} : { foreground: this.#foreground }),
      bold: this.#bold,
    };
  }

  private applySgr(command: string): void {
    const values = command.split(';').map(Number);
    for (let index = 0; index < values.length; index += 1) {
      const code = values[index]!;
      if (code === 38 || code === 48) {
        const mode = values[index + 1];
        index += mode === 2 ? 4 : mode === 5 ? 2 : 0;
        continue;
      }
      if (code === 0) {
        this.#foreground = undefined;
        this.#bold = false;
      } else if (code === 1) this.#bold = true;
      else if (code === 22) this.#bold = false;
      else if (code === 39) this.#foreground = undefined;
      else if (colors.has(code)) this.#foreground = colors.get(code);
    }
  }
}

export function parseTerminalOutput(value: string): TerminalLine[] {
  const parser = new TerminalOutputParser();
  parser.append(value);
  return parser.lines();
}
