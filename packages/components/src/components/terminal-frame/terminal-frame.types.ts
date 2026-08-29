import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type TerminalFrameStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type TerminalFrameDimensions = {
  columns: number;
  rows: number;
};

export type TerminalFrameProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'title'> & {
  title: string;
  status?: TerminalFrameStatus;
  error?: string;
  onreload?: () => void;
  onresize?: (dimensions: TerminalFrameDimensions) => void;
  columnWidth?: number;
  rowHeight?: number;
  children: Snippet;
  class?: string;
};
