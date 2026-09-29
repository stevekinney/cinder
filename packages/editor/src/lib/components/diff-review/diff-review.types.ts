import type { HTMLAttributes } from 'svelte/elements';

import type { DiffReviewState, DiffReviewTargetInput } from '../../diff-review-state/index.ts';

export type DiffReviewProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /**
   * The live content for every target in `state`, in the same shape
   * `createDiffReviewState`/the `set-targets` action take. `DiffReviewState`
   * itself carries only identity (id/kind/label/snapshot) -- the host owns
   * the actual document/patch text and keeps both in sync via its own
   * `set-targets` dispatch when content changes.
   */
  targets: DiffReviewTargetInput[];
  /** Controlled diff-review session state. Never mutated directly. */
  state: DiffReviewState;
  /**
   * Called whenever an action succeeds. Named `onStateChange` (camelCase)
   * rather than the cross-package contract's lowercase `onstatechange` --
   * see `DiffReviewComments`' identical note.
   */
  onStateChange: (next: DiffReviewState) => void;
  /**
   * Disables every mutating control (comments, drafts, Reviewed, review
   * note). Navigation, filtering, and export remain available. A line-level
   * comment's "Go to" always reports its anchor unavailable in this mode,
   * per the underlying viewers' own contract (see README, "Comment-to-anchor
   * navigation") -- file navigation and comment viewing themselves are not
   * otherwise affected.
   * @default false
   */
  readonly?: boolean;
  /** Markdown export heading. @default 'Review feedback' */
  reviewTitle?: string;
  class?: string;
};
