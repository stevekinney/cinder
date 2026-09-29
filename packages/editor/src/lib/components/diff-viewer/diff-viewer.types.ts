import type { DiffHunk, LineDiff, LineDiffStats } from '@lostgradient/markdown';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type DiffViewerMode = 'unified' | 'final' | 'original';

/** Context passed to toolbar snippets for custom rendering */
export interface DiffToolbarContext {
  hunks: DiffHunk[];
  stats: LineDiffStats;
  hasChanges: boolean;
  viewMode: DiffViewerMode;
}

// ============================================================================
// Annotation selection (COR-514 / DR-4)
// ============================================================================

export type DiffViewerAnnotationSide = 'old' | 'new';

export type DiffViewerAnnotationCoordinateSpace = 'raw-source' | 'normalized-markdown';

/** Raw mapping provenance, matching the DR-2 diff-review-state contract's field shape. */
export type DiffViewerRawMapping =
  { status: 'exact' } | { status: 'unavailable'; reason: 'normalization' };

/**
 * A single-line or contiguous-range selection on one side of the Markdown
 * body. Structurally mirrors the diff-review state anchor field vocabulary
 * (`side`, `startLine`, `endLine`, `coordinateSpace`, `selectedText`,
 * `contextBefore`, `contextAfter`, `fileOccurrence`, `hunkOccurrence`)
 * without importing it -- this component never depends on
 * `@lostgradient/editor`'s `diff-review-state` module. `fileOccurrence` is
 * always `0`: DiffViewer compares exactly one document pair, never multiple
 * files.
 */
export type DiffViewerAnnotationSelection = {
  fileOccurrence: number;
  hunkOccurrence: number;
  side: DiffViewerAnnotationSide;
  /** Inclusive, one-based; direct line count including leading front matter. */
  startLine: number;
  /** Inclusive, one-based. */
  endLine: number;
  coordinateSpace: DiffViewerAnnotationCoordinateSpace;
  rawMapping: DiffViewerRawMapping;
  selectedText: string;
  /** Up to three same-side lines immediately before `startLine`, in document order. */
  contextBefore: string[];
  /** Up to three same-side lines immediately after `endLine`, in document order. */
  contextAfter: string[];
};

/**
 * Reason an attempted selection extension was rejected. Narrower than
 * `SourceDiffViewer`'s equivalent: a Markdown document is one continuous
 * body, not a file/hunk-partitioned patch, so there is no `cross-file` or
 * `cross-hunk` rejection here.
 */
export type DiffViewerAnnotationRejectionReason = 'cross-side' | 'edge';

export type DiffViewerAnnotationRejection = {
  ok: false;
  reason: DiffViewerAnnotationRejectionReason;
  message: string;
};

export type DiffViewerAnnotationResult =
  { ok: true; selection: DiffViewerAnnotationSelection } | DiffViewerAnnotationRejection;

/** Context passed to the `fileAnnotation` snippet for the front-matter section. */
export type DiffViewerFrontMatterAnnotationContext = {
  /** Front-matter field names (YAML-style keys) touched by a change, best-effort parsed. */
  changedFields: string[];
};

/** Context passed to the `lineAnnotation` snippet for each commentable row/side. */
export type DiffViewerLineAnnotationContext = {
  side: DiffViewerAnnotationSide;
  /** The absolute (front-matter-offset-inclusive) line number this control anchors to. */
  line: number;
  diff: LineDiff;
};

/** Result of a `focusAnchor` instance-method call. */
export type DiffViewerFocusResult = {
  status: 'focused' | 'unavailable';
};

/** Programmatic handle exposed through `bind:ref`. */
export type DiffViewerRef = {
  /**
   * Switches view mode as needed to expose the anchor's side (a `final`-mode
   * viewer switches to `unified` to expose an `old`-side anchor, and an
   * `original`-mode viewer switches to `unified` to expose a `new`-side
   * anchor), then focuses its annotation control.
   */
  focusAnchor: (
    anchor: Pick<DiffViewerAnnotationSelection, 'side' | 'startLine'>,
  ) => DiffViewerFocusResult;
};

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
  onRevertAll?: () => void;
  /** Called when user wants to revert a specific hunk */
  onRevertHunk?: (hunkIndex: number, hunk: DiffHunk) => void;
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
  viewMode?: DiffViewerMode;
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
  /**
   * Rendered once alongside the front-matter section, whenever the document
   * has front matter. Front matter offers file-level comments only (its
   * changes aren't cleanly attributable to one selectable line), so this
   * snippet receives the changed field names as context rather than a line
   * anchor. Unlike `lineAnnotation`, it renders regardless of whether
   * `onAnnotationSelectionChange` is supplied.
   */
  fileAnnotation?: Snippet<[DiffViewerFrontMatterAnnotationContext]> | undefined;
  /**
   * Rendered next to each commentable row's add-comment control. Like that
   * control, it only appears when `onAnnotationSelectionChange` is also
   * supplied -- pass both to render per-line annotation markers.
   */
  lineAnnotation?: Snippet<[DiffViewerLineAnnotationContext]> | undefined;
  /**
   * Controlled current annotation selection. Distinct from ordinary diff
   * navigation and view-mode state: setting or clearing it never affects
   * which lines are shown.
   */
  annotationSelection?: DiffViewerAnnotationSelection | null | undefined;
  /**
   * Called when the user commits, extends, or clears an annotation
   * selection.
   */
  onAnnotationSelectionChange?:
    ((selection: DiffViewerAnnotationSelection | null) => void) | undefined;
  /** Programmatic handle for `focusAnchor`. */
  ref?: DiffViewerRef | undefined;
  /** Additional CSS classes */
  class?: string;
};
