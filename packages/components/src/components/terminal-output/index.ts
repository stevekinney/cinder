import './terminal-output.css';
import TerminalOutput from './terminal-output.svelte';
export default TerminalOutput;
export { parseTerminalOutput } from './terminal-output-parser.ts';
export type {
  TerminalForeground,
  TerminalLine,
  TerminalOutputProps,
  TerminalTextRun,
} from './terminal-output.types.ts';
export { TerminalOutput };
