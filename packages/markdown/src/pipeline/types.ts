/**
 * Type definitions for the Markdown pipeline.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 *
 * @module
 */

import type { Content, Root } from 'mdast';
import type { Position } from 'unist';
import type { MarkdownParseError } from './errors.js';

// Re-export core mdast types for consumers
export type { Content, Position, Root };

// Re-export commonly used node types
export type {
  Blockquote,
  Break,
  Code,
  Delete,
  Emphasis,
  Heading,
  Html,
  Image,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  Strong,
  Table,
  TableCell,
  TableRow,
  Text,
  ThematicBreak,
} from 'mdast';

/**
 * Options for parsing Markdown to AST.
 */
export interface ParseOptions {
  /**
   * Whether to preserve source positions in the AST.
   * Required for comment anchoring (DEP-39) and diff computation (DEP-42).
   * @default true
   */
  positions?: boolean;
}

/**
 * Successful parse result.
 */
export interface ParseSuccess {
  success: true;
  ast: Root;
}

/**
 * Failed parse result.
 */
export interface ParseFailure {
  success: false;
  error: MarkdownParseError;
}

/**
 * Discriminated union for parse results.
 * Use pattern matching to handle success/failure:
 *
 * @example
 * ```ts
 * const result = parse(markdown);
 * if (result.success) {
 *   console.log(result.ast);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Options for serializing AST to Markdown.
 * Most options are locked for deterministic output.
 *
 * Currently no user-configurable options - all serialization
 * options are locked for determinism.
 */
export type SerializeOptions = Record<string, never>;

export type { MarkdownParseError };

/**
 * Result of parsing front matter from a Markdown document.
 * DEP-61: Front matter (YAML) parsing and editing support
 */
export interface FrontMatterParseResult {
  /** Parsed front matter data (null if no front matter present) */
  data: Record<string, unknown> | null;
  /** Raw YAML string (null if no front matter present) */
  raw: string | null;
  /** Document body (Markdown content after front matter) */
  body: string;
  /**
   * Whether the document has *valid, recognized* front matter -- a
   * `---`-delimited span whose content parses as object-shaped YAML (or is
   * blank/comment-only). `false` covers two genuinely different cases a
   * caller must not conflate: "there's no `---` fence here at all," and
   * "there's a `---`...`---` fence, but its content isn't valid front
   * matter" (a Markdown list, a scalar, invalid YAML). Only the first case
   * is safe to treat as "prepend a fresh front-matter block onto this
   * document" -- see {@link fencePresent}, which distinguishes them.
   */
  hasFrontMatter: boolean;
  /**
   * Whether a `---`...`---` delimited span exists at the start of the
   * document at all, regardless of whether its content is valid front
   * matter. `true` whenever `hasFrontMatter` is `true`, and also `true` for
   * a fenced span whose content failed YAML/object-shape validation --
   * `false` only when there is no such span (no leading `---`, or no
   * matching closing `---`).
   *
   * A caller deciding whether it's safe to *prepend* a new front-matter
   * block onto a document's raw text should check `fencePresent`, not
   * `hasFrontMatter`: `hasFrontMatter === false` does not mean "this text
   * has no `---` prefix to collide with" -- it can also mean "this text
   * has a `---`...`---` prefix that just isn't valid front matter," and
   * prepending onto that duplicates the fence (cinder#1324/#1325 follow-up).
   */
  fencePresent: boolean;
}

/**
 * Options for serializing front matter.
 * DEP-61: Front matter (YAML) parsing and editing support
 */
export interface FrontMatterSerializeOptions {
  /**
   * Whether to preserve the original raw YAML string when no edits were made.
   * When false, always regenerates YAML from data using deterministic ordering.
   * @default true
   */
  preserveRaw?: boolean;

  /**
   * Original raw YAML to preserve when preserveRaw is true and data is unchanged.
   * If provided and data hasn't changed, this exact string is used.
   */
  originalRaw?: string | null;

  /**
   * Original parsed data to compare against for detecting changes.
   * Only used when preserveRaw is true and originalRaw is provided.
   */
  originalData?: Record<string, unknown> | null;

  /**
   * Whether to preserve empty front matter block (`---\n---\n`) when data is null/empty.
   * When true and data is null/empty, outputs `---\n---\n{body}` instead of just body.
   * This is useful when editing a document that originally had empty front matter.
   * @default false
   */
  preserveEmptyFrontMatter?: boolean;
}

/**
 * Complete document with front matter and body separated.
 * DEP-61: Front matter (YAML) parsing and editing support
 */
export interface DocumentWithFrontMatter {
  /** Parsed front matter data (null if no front matter present) */
  frontMatter: Record<string, unknown> | null;
  /** Raw YAML string (null if no front matter present) */
  frontMatterRaw: string | null;
  /** Document body (Markdown content after front matter) */
  body: string;
}
