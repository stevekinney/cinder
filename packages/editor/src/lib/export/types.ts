/**
 * Types for ReviewEditor export functionality.
 *
 * These types define the options and results for exporting review data
 * in LLM-friendly and Git-compatible formats.
 */

/**
 * Options for generating an LLM-optimized Markdown summary.
 */
export interface MarkdownSummaryOptions {
  /** Include ISO timestamps on comments. Default: false */
  includeTimestamps?: boolean | undefined;

  /** Include author IDs on comments. Default: false */
  includeAuthorIds?: boolean | undefined;

  /** Number of context lines around changes. Default: 2 */
  contextLines?: number | undefined;
}

/**
 * Result from generating an LLM-optimized Markdown summary.
 */
export interface MarkdownSummaryResult {
  /** The generated Markdown summary */
  markdown: string;

  /** Statistics about the exported content */
  stats: {
    /** Number of document changes */
    changeCount: number;
    /** Number of comment threads */
    threadCount: number;
  };
}

/**
 * Options for generating a Git-compatible unified diff.
 */
export interface UnifiedDiffOptions {
  /** Path for the original file header. Default: 'a/document.md' */
  originalPath?: string | undefined;

  /** Path for the current file header. Default: 'b/document.md' */
  currentPath?: string | undefined;

  /** Number of context lines around changes. Default: 3 */
  contextLines?: number | undefined;

  /**
   * Include front matter in diff output. Default: false
   *
   * Modern ReviewState content may already include front matter. When enabled,
   * this option only prepends `frontMatterRaw` for older body-only state payloads.
   */
  includeFrontMatter?: boolean | undefined;
}

/**
 * Result from generating a Git-compatible unified diff.
 */
export interface UnifiedDiffResult {
  /** The generated unified diff string */
  diff: string;

  /** Statistics about the diff */
  stats: {
    /** Number of lines added */
    additions: number;
    /** Number of lines removed */
    deletions: number;
    /** Number of diff hunks */
    hunks: number;
  };
}

/**
 * Options for generating LLM-optimized comments export.
 */
export interface CommentsExportOptions {
  /** Include ISO timestamps on comments. Default: true */
  includeTimestamps?: boolean | undefined;

  /** Include author IDs on comments. Default: true */
  includeAuthorIds?: boolean | undefined;
}

/**
 * Result from generating LLM-optimized comments export.
 */
export interface CommentsExportResult {
  /** The generated Markdown string */
  markdown: string;

  /** Statistics about the exported comments */
  stats: {
    /** Total number of threads exported */
    threadCount: number;
    /** Total number of comments exported */
    commentCount: number;
    /** Number of document-level comments */
    documentCommentCount: number;
  };
}

/**
 * Options for generating JSON comments export.
 */
export interface CommentsJSONOptions {
  /** Include author IDs on comments. Default: true */
  includeAuthorIds?: boolean | undefined;

  /** Include timestamps on comments. Default: true */
  includeTimestamps?: boolean | undefined;
}

/**
 * Structured comment data for JSON export.
 */
export interface ExportedComment {
  /** Comment ID */
  id: string;
  /** Comment body text */
  body: string;
  /** Author ID (if included) */
  authorId?: string | undefined;
  /** Creation timestamp (if included) */
  createdAt?: string | undefined;
  /** Update timestamp (if included) */
  updatedAt?: string | undefined;
}

/**
 * Structured thread selection data for JSON export.
 */
export interface ExportedSelection {
  /** Selected text */
  text: string;
  /** Character offset from start */
  from: number;
  /** Character offset to end */
  to: number;
  /** Line number (if available) */
  line?: number | undefined;
  /** Column number (if available) */
  column?: number | undefined;
}

/**
 * Structured thread data for JSON export.
 */
export interface ExportedThread {
  /** Thread ID */
  id: string;
  /** Thread type: 'text' for text-anchored, 'document' for document-level */
  type: 'text' | 'document';
  /** Selection info (only for text-anchored threads) */
  selection?: ExportedSelection | undefined;
  /** Comments in the thread */
  comments: ExportedComment[];
}

/**
 * Result from generating JSON comments export.
 */
export interface CommentsJSONResult {
  /** The JSON string */
  json: string;

  /** Structured data (before serialization) */
  data: {
    threads: ExportedThread[];
  };

  /** Statistics about the exported comments */
  stats: {
    /** Total number of threads exported */
    threadCount: number;
    /** Total number of comments exported */
    commentCount: number;
    /** Number of document-level threads */
    documentThreadCount: number;
  };
}
