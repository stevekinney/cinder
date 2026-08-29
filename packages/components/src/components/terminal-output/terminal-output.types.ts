import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type TerminalForeground =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15;
export type TerminalTextRun = { text: string; foreground?: TerminalForeground; bold?: boolean };
export type TerminalLine = readonly TerminalTextRun[];
export type TerminalOutputProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  value?: string;
  class?: string;
  children?: Snippet;
};
