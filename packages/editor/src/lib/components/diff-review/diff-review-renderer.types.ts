import type {
  DiffReviewRangeAnchor,
  DiffReviewState,
  DiffReviewTargetInput,
} from '../../diff-review-state/index.ts';
import type { DiffReviewAnnotationBridgeResult } from './diff-review-annotation-bridge.ts';

/** Result of a `DiffReviewRendererRef` focus call -- mirrors the viewers' own shape. */
export type DiffReviewRendererFocusResult = { status: 'focused' | 'unavailable' };

/**
 * Unified programmatic focus handle over whichever viewer is currently
 * mounted (COR-509 / DR-6, "comment-to-anchor navigation"). Delegates to
 * `DiffViewer`'s or `SourceDiffViewer`'s own public `ref.focusAnchor`/
 * `ref.focusFile` -- never reimplements DOM focus itself.
 */
export type DiffReviewRendererRef = {
  /** Focuses the control for a range anchor's side/line, switching mode/file as needed. */
  focusAnchor: (
    anchor: Pick<DiffReviewRangeAnchor, 'fileOccurrence' | 'hunkOccurrence' | 'side' | 'startLine'>,
  ) => DiffReviewRendererFocusResult;
  /**
   * Focuses the labeled header of a file occurrence. A Markdown target has
   * no equivalent focus target through the public `DiffViewer` surface, so
   * this always reports `unavailable` for a Markdown-backed renderer.
   */
  focusFile: (fileOccurrence: number) => DiffReviewRendererFocusResult;
};

export interface DiffReviewRendererProps {
  target: DiffReviewTargetInput | undefined;
  /** Controlled diff-review session state, for current-only inline saved-comment markers. */
  state: DiffReviewState;
  selectedFileOccurrence: number | null;
  readonly?: boolean;
  /** Incrementing this clears any in-progress viewer selection (e.g. after Save/Cancel). */
  resetToken: number;
  onSelectionChange: (result: DiffReviewAnnotationBridgeResult | null) => void;
  /**
   * Called with `true` when the mounted viewer throws while rendering this
   * target, and with `false` whenever the target changes (a prior
   * target's failure never carries over). The host uses this to disable
   * that target's own comment-creation controls while leaving every other
   * target and export unaffected.
   */
  onRendererFailedChange?: (failed: boolean) => void;
  /** Bindable: programmatic focus handle for comment-to-anchor navigation. */
  ref?: DiffReviewRendererRef | undefined;
}
