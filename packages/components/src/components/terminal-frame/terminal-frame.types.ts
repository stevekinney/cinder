import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type TerminalFrameStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type TerminalFrameDimensions = {
  cols: number;
  rows: number;
};

export type TerminalFrameProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'title'> & {
  /** Title shown in the frame chrome. */
  title: string;
  /** Connection status shown in the frame chrome. Defaults to `'connecting'`. @default 'connecting' */
  status?: TerminalFrameStatus;
  /**
   * Recovery error message. The recovery UI is gated on `error` being a
   * non-empty string (`{#if error}`), not on `status`—`error=""` shows
   * nothing, the same as `undefined`, even though the prop is set. If
   * `error` stays non-empty after `status` moves away from `'error'` (for
   * example to `'connected'`), the recovery UI remains visible until the
   * caller clears `error` too.
   */
  error?: string;
  /**
   * Called when the user requests a reload from the recovery UI. The
   * recovery UI (and this button) show whenever `error` is a non-empty
   * string, regardless of the current `status`—see that prop.
   */
  onReloadRequest?: () => void;
  /**
   * Called with `{ cols, rows }` whenever the character-cell size changes,
   * so the host can resize its PTY. A new measurement is never taken—and
   * this never fires from one—while `columnWidth` or `rowHeight` is
   * non-finite or `<= 0`. That's not an absolute guarantee this never
   * fires while invalid, though: the component replays the last valid
   * measurement whenever the `onDimensionsChange` reference itself changes
   * (e.g. a parent passing a new inline handler each render), and that
   * replay doesn't re-check `columnWidth`/`rowHeight`—so a stale
   * measurement can still reach a newly-passed handler even after the
   * cell size becomes invalid.
   */
  onDimensionsChange?: (dimensions: TerminalFrameDimensions) => void;
  /**
   * Character-cell width, in pixels, used to compute `{ cols, rows }` on
   * resize. Must be positive and finite for a new measurement to run (see
   * `onDimensionsChange` for the one exception). Defaults to `8`.
   * @default 8
   */
  columnWidth?: number;
  /**
   * Character-cell height, in pixels, used to compute `{ cols, rows }` on
   * resize. Must be positive and finite for a new measurement to run (see
   * `onDimensionsChange` for the one exception). Defaults to `18`.
   * @default 18
   */
  rowHeight?: number;
  /** Consumer-owned PTY renderer. */
  children: Snippet;
  /** Additional class merged with the component's root class. */
  class?: string;
};
