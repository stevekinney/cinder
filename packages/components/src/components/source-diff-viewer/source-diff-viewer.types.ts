import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type SourceDiffLineKind = 'addition' | 'removal' | 'context' | 'metadata';

export type SourceDiffLine = {
  kind: SourceDiffLineKind;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  metadataPrefix?: '\\';
};

export type SourceDiffHunk = {
  header: string;
  oldStart: number | null;
  oldCount: number | null;
  newStart: number | null;
  newCount: number | null;
  lines: SourceDiffLine[];
  /**
   * Zero-based occurrence of this hunk within its file, assigned while parsing
   * the full patch and preserved through `maxLines` pruning. Stable even when
   * a lower-occurrence hunk in the same file is later dropped for having no
   * rendered content.
   */
  hunkOccurrence: number;
};

export type SourceDiffFile = {
  oldPath: string | null;
  newPath: string | null;
  header: string | null;
  metadata: string[];
  hunks: SourceDiffHunk[];
  /**
   * Zero-based occurrence of this file within the patch, assigned while
   * parsing the full patch and preserved through `maxLines` pruning. Stable
   * even when a lower-occurrence file is later dropped for having no
   * rendered content (repeated paths across files never collide on this).
   */
  fileOccurrence: number;
};

/**
 * A descriptor for every file the parser recognized, including files whose
 * content was entirely cut by `maxLines` and therefore does not appear in
 * `SourceDiffParseResult.files`. Assigned before display pruning.
 */
export type SourceDiffFileDescriptor = {
  fileOccurrence: number;
  oldPath: string | null;
  newPath: string | null;
  header: string | null;
  label: string;
  /** Total hunks recognized for this file, before any hunk-level pruning. */
  hunkCount: number;
  /** Total addition + removal rows recognized for this file, before `maxLines` pruning. */
  changedLineCount: number;
  /** True when none of this file's rows survived `maxLines` pruning. */
  fullyTruncated: boolean;
};

export type SourceDiffParseResult = {
  files: SourceDiffFile[];
  totalLineCount: number;
  renderedLineCount: number;
  truncated: boolean;
  /** Descriptors for every recognized file, including fully truncated ones. */
  descriptors: SourceDiffFileDescriptor[];
};

// ============================================================================
// Annotation selection
// ============================================================================

export type SourceDiffAnnotationSide = 'old' | 'new';

/**
 * A single-line or contiguous-range selection on one side of one hunk of one
 * file. Structurally mirrors the diff-review state anchor field vocabulary
 * (`fileOccurrence`, `hunkOccurrence`, `side`, `startLine`, `endLine`,
 * `coordinateSpace`, `selectedText`, `contextBefore`, `contextAfter`) without
 * importing it — this component never depends on `@lostgradient/editor`.
 */
export type SourceDiffAnnotationSelection = {
  fileOccurrence: number;
  hunkOccurrence: number;
  side: SourceDiffAnnotationSide;
  /** Inclusive, one-based. */
  startLine: number;
  /** Inclusive, one-based. */
  endLine: number;
  /** Always `'raw-source'`: source patches never claim normalized coordinates. */
  coordinateSpace: 'raw-source';
  selectedText: string;
  /** Up to three same-side lines immediately before `startLine`, in document order. */
  contextBefore: string[];
  /** Up to three same-side lines immediately after `endLine`, in document order. */
  contextAfter: string[];
  oldPath: string | null;
  newPath: string | null;
};

/** Reason an attempted selection extension or commit was rejected. */
export type SourceDiffAnnotationRejectionReason =
  'cross-file' | 'cross-hunk' | 'cross-side' | 'edge';

export type SourceDiffAnnotationRejection = {
  ok: false;
  reason: SourceDiffAnnotationRejectionReason;
  message: string;
};

export type SourceDiffAnnotationResult =
  { ok: true; selection: SourceDiffAnnotationSelection } | SourceDiffAnnotationRejection;

/** Context passed to the `fileAnnotation` snippet for each recognized file. */
export type SourceDiffFileAnnotationContext = {
  descriptor: SourceDiffFileDescriptor;
};

/** Context passed to the `lineAnnotation` snippet for each commentable row. */
export type SourceDiffLineAnnotationContext = {
  fileOccurrence: number;
  hunkOccurrence: number;
  line: SourceDiffLine;
  /** The side an add-comment control on this row would anchor to. */
  side: SourceDiffAnnotationSide;
};

/** Result of a `focusFile`/`focusAnchor` instance-method call. */
export type SourceDiffViewerFocusResult = {
  status: 'focused' | 'unavailable';
};

/** Programmatic handle exposed through `bind:ref`. */
export type SourceDiffViewerRef = {
  /** Focuses the labeled header of the given file occurrence, if rendered. */
  focusFile: (fileOccurrence: number) => SourceDiffViewerFocusResult;
  /** Focuses the line control for the given anchor, if its row is rendered. */
  focusAnchor: (
    anchor: Pick<SourceDiffAnnotationSelection, 'fileOccurrence' | 'hunkOccurrence' | 'side'> & {
      startLine: number;
    },
  ) => SourceDiffViewerFocusResult;
};

export type SourceDiffViewerProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Unified patch text to parse and render. */
  patch: string;
  /** Accessible label for the diff region. */
  ariaLabel?: string;
  /** Maximum number of diff rows to render before truncating. */
  maxLines?: number;
  /** Whether old and new line-number gutters are rendered. */
  lineNumbers?: boolean;
  /**
   * Rendered when the patch is empty or contains no displayable diff rows.
   * Falls back to a default "No patch lines to display." message — matching
   * the `empty` snippet the chart/command families expose.
   */
  empty?: Snippet;
  /** Additional CSS classes merged with `.cinder-source-diff-viewer`. */
  class?: string;
  /**
   * Called with a descriptor for every recognized file whenever the parsed
   * patch changes. Named `onFilesChange` (camelCase) rather than the
   * lowercase `onfileschange` the cross-package diff-review contract uses
   * elsewhere: this repository's `check-prop-conventions` gate structurally
   * bans a non-native-passthrough lowercase `on*` prop, so the callback
   * casing is translated to this repository's house style while every field
   * name and the payload shape stay exactly as specified.
   */
  onFilesChange?: (files: SourceDiffFileDescriptor[]) => void;
  /**
   * Controlled zero-based file occurrence to render exclusively. Absent
   * (the default) renders every file, matching prior behavior.
   */
  activeFileOccurrence?: number | null;
  /** Rendered next to each file's header, alongside its file-level annotation controls. */
  fileAnnotation?: Snippet<[SourceDiffFileAnnotationContext]>;
  /**
   * Rendered next to each commentable row's add-comment control. Like that
   * control, it only appears when `onAnnotationSelectionChange` is also
   * supplied — pass both to render per-line annotation markers.
   */
  lineAnnotation?: Snippet<[SourceDiffLineAnnotationContext]>;
  /**
   * Controlled current annotation selection. Distinct from ordinary diff
   * navigation: setting or clearing it never affects which rows are shown.
   */
  annotationSelection?: SourceDiffAnnotationSelection | null;
  /**
   * Called when the user commits, extends, or clears an annotation
   * selection. See `onFilesChange` above for why this repository spells the
   * contract's `onannotationselectionchange` as camelCase.
   */
  onAnnotationSelectionChange?: (selection: SourceDiffAnnotationSelection | null) => void;
  /** Programmatic handle for `focusFile`/`focusAnchor`. */
  ref?: SourceDiffViewerRef | undefined;
};
