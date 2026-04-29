/**
 * Markdown parser with GFM support.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 *
 * This module provides parsing functions that convert Markdown strings
 * to mdast AST. The parser supports CommonMark + GFM (tables, task lists,
 * strikethrough).
 *
 * @module
 */

import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { MarkdownParseError } from './errors.js';
import { stripPositions } from './strip-positions.js';
import type { ParseOptions, ParseResult } from './types.js';

/**
 * Singleton processor for parsing.
 *
 * The processor is stateless and can be reused across calls.
 * It includes:
 * - remarkParse: CommonMark parser
 * - remarkGfm: GFM extensions (tables, task lists, strikethrough)
 */
const parseProcessor = unified().use(remarkParse).use(remarkGfm);

/**
 * Parse a Markdown string to an mdast AST.
 *
 * Returns a discriminated union for explicit error handling.
 * Use pattern matching to handle success/failure cases.
 *
 * Note: remark-parse is very lenient and rarely fails. Most malformed
 * Markdown is parsed as paragraph text rather than causing errors.
 *
 * @param markdown - The Markdown string to parse
 * @param options - Parse options
 * @returns A discriminated union with `success: true` and `ast`, or `success: false` and `error`
 *
 * @example
 * ```ts
 * import { parse } from '$lib/document/pipeline';
 *
 * const result = parse('# Hello\n\nWorld');
 * if (result.success) {
 *   console.log(result.ast.children.length); // 2
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function parse(markdown: string, options: ParseOptions = {}): ParseResult {
  const { positions = true } = options;

  // Handle null/undefined input
  if (markdown == null) {
    return {
      success: false,
      error: new MarkdownParseError('Input cannot be null or undefined', String(markdown)),
    };
  }

  try {
    let ast = parseProcessor.parse(markdown);

    // Strip positions if explicitly disabled (default is to preserve them)
    if (!positions) {
      ast = stripPositions(ast);
    }

    return { success: true, ast };
  } catch (err) {
    return {
      success: false,
      error: new MarkdownParseError(
        err instanceof Error ? err.message : 'Unknown parse error',
        markdown,
      ),
    };
  }
}

/**
 * Parse a Markdown string to an mdast AST, throwing on failure.
 *
 * Use this when you expect valid input and prefer exceptions over
 * explicit error handling.
 *
 * @param markdown - The Markdown string to parse
 * @param options - Parse options
 * @returns The parsed mdast AST
 * @throws {MarkdownParseError} If parsing fails
 *
 * @example
 * ```ts
 * import { parseOrThrow } from '$lib/document/pipeline';
 *
 * try {
 *   const ast = parseOrThrow('# Hello');
 *   console.log(ast.children[0].type); // 'heading'
 * } catch (err) {
 *   if (err instanceof MarkdownParseError) {
 *     console.error('Parse failed:', err.message);
 *   }
 * }
 * ```
 */
export function parseOrThrow(markdown: string, options: ParseOptions = {}): Root {
  const result = parse(markdown, options);
  if (!result.success) {
    throw result.error;
  }
  return result.ast;
}
