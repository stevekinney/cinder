import type { DiffHunk, LineDiffStats } from '@cinder/markdown/diff/line-diff';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type ViewMode = 'unified' | 'final' | 'original';

/** Context passed to toolbar snippets for custom rendering */
export interface DiffToolbarContext {
  hunks: DiffHunk[];
  stats: LineDiffStats;
  hasChanges: boolean;
  viewMode: ViewMode;
}

export type DiffViewerProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** The original/baseline text */
  original: string;
  /** The current/modified text */
  current: string;
  /**
   * Whether to normalize markdown inputs before comparison.
   * When true (default), both original and current are normalized
   * to canonical form before diffing, preventing false positives
   * from formatting differences.
   */
  normalizeInputs?: boolean;
  /** Called when user wants to revert all changes */
  onrevertall?: () => void;
  /** Called when user wants to revert a specific hunk */
  onreverthunk?: (hunkIndex: number, hunk: DiffHunk) => void;
  /** Whether the viewer is read-only (hides revert buttons) */
  readonly?: boolean;
  /**
   * Bindable: reactive access to computed hunks.
   * Parent components can bind to this to reactively access hunk data.
   */
  hunks?: DiffHunk[];
  /**
   * Bindable: reactive access to current view mode.
   * Parent components can bind to control or observe the view mode.
   */
  viewMode?: ViewMode;
  /**
   * Additional toolbar actions rendered in the toolbar-right section.
   * Use this to inject custom buttons (e.g., export actions) without
   * replacing the entire toolbar.
   */
  toolbarActions?: Snippet<[DiffToolbarContext]>;
  /**
   * Override the entire toolbar for advanced customization.
   * When provided, replaces the default toolbar completely.
   */
  toolbar?: Snippet<[DiffToolbarContext]>;
  /** Additional CSS classes */
  class?: string;
};
