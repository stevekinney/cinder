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
};

export type SourceDiffFile = {
  oldPath: string | null;
  newPath: string | null;
  header: string | null;
  metadata: string[];
  hunks: SourceDiffHunk[];
};

export type SourceDiffParseResult = {
  files: SourceDiffFile[];
  totalLineCount: number;
  renderedLineCount: number;
  truncated: boolean;
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
  /** Message shown when the patch is empty or contains no diffable rows. */
  emptyMessage?: string;
  /** Additional CSS classes merged with `.cinder-source-diff-viewer`. */
  class?: string;
};
