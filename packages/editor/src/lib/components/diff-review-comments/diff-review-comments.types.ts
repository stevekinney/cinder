import type { HTMLAttributes } from 'svelte/elements';

import type { DiffReviewComment, DiffReviewState } from '../../diff-review-state/index.ts';
import type { DiffReviewCommentsFilter } from './diff-review-comments-filter.ts';

export type { DiffReviewCommentsFilter } from './diff-review-comments-filter.ts';

export type DiffReviewCommentsProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Controlled diff-review session state. Never mutated directly. */
  state: DiffReviewState;
  /**
   * Called whenever a comment/review-note action succeeds. Named `onStateChange`
   * (camelCase) rather than the cross-package contract's lowercase
   * `onstatechange`: this repository's `check-prop-conventions` gate
   * structurally bans a non-native-passthrough lowercase `on*` prop (see
   * `@lostgradient/cinder`'s `SourceDiffViewer.onFilesChange` for the same,
   * earlier translation) — the field name and payload are otherwise exactly
   * the contract's.
   */
  onStateChange: (next: DiffReviewState) => void;
  /**
   * Disables create/edit/delete/resolve/reopen and review-note editing.
   * Viewing and filtering remain available.
   * @default false
   */
  readonly?: boolean;
  /** Initial comment filter. Uncontrolled after mount — the person can change it locally. */
  defaultFilter?: DiffReviewCommentsFilter;
  /**
   * Called when a person activates a CURRENT comment's "Go to" action --
   * never for an outdated or removed one, which instead moves focus to that
   * comment's own captured-detail text in place. The host uses this to
   * focus the comment's anchor in whichever diff viewer it owns (through
   * that viewer's own public `focusAnchor`/`focusFile`, e.g.
   * `DiffReview`'s internal `DiffReviewRenderer`, or a standalone viewer's
   * own `ref` in a host that composes this panel next to one directly).
   */
  onNavigate?: (comment: DiffReviewComment) => void;
  class?: string;
};
