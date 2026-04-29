/**
 * Type definitions for the markdown rendering pipeline.
 *
 * DEP-49: Chat markdown rendering pipeline + sanitization.
 *
 * @module
 */

/**
 * Metadata for a code block, used for copy hooks.
 */
export interface CodeBlockInfo {
  /** Programming language identifier (e.g., "typescript", "python") */
  language: string | null;
  /** Meta string after language (e.g., "title=example.ts") */
  meta: string | null;
  /** Raw code content */
  value: string;
  /** Zero-indexed position in the document */
  index: number;
}

/**
 * Options for markdown rendering.
 */
export interface RenderOptions {
  /**
   * Allow data: URLs for images.
   * When true, data:image/* URLs with safe MIME types are permitted.
   * @default false
   */
  allowDataImages?: boolean;

  /**
   * Strip links from rendered output.
   * When true, link nodes are converted to plain text (preserving the link text).
   * Useful when rendering inside anchor elements to avoid nested anchors.
   * @default false
   */
  stripLinks?: boolean;
}

/**
 * Result of rendering markdown to HTML.
 */
export interface RenderResult {
  /** Original markdown string (unchanged, for copy/export) */
  rawMarkdown: string;
  /** Sanitized HTML output */
  html: string;
  /** Extracted code block metadata for copy hooks */
  codeBlocks: CodeBlockInfo[];
  /** Whether unsafe content was stripped during rendering */
  hadUnsafeContent: boolean;
}
