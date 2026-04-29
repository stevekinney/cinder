/**
 * Deterministic Markdown serializer.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 *
 * This module provides a serialization function that converts mdast AST
 * back to Markdown strings with deterministic output. The same AST will
 * always produce the same Markdown string.
 *
 * @module
 */

import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

/**
 * Deterministic serialization options.
 *
 * These are LOCKED to ensure consistent output across all serializations.
 * Changing these would break semantic equivalence guarantees.
 *
 * All variations (e.g., `*` vs `_` for emphasis) are semantically equivalent
 * in Markdown, but we pick one style to ensure `serialize(parse(a))` always
 * produces the same output for equivalent inputs.
 */
export const serializerOptions = {
  /** Use `-` for unordered list bullets (not `*` or `+`) */
  bullet: '-',

  /** Use `*` for emphasis (not `_`) */
  emphasis: '*',

  /** Use backticks for code fences (not `~`) */
  fence: '`',

  /** Always use fenced code blocks (never indented) */
  fences: true,

  /** Always use ATX headings `# H1` (never setext `===`) */
  setext: false,

  /** Single space after bullet in list items */
  listItemIndent: 'one',

  /** Use `-` for horizontal rules */
  rule: '-',

  /** Use `*` for strong (not `_`) */
  strong: '*',

  /** No blank lines in definition lists */
  tightDefinitions: true,
} as const;

/**
 * Singleton processor for serialization.
 *
 * The processor is stateless and can be reused across calls.
 * This avoids recreating the processor chain on every serialize call.
 */
const serializeProcessor = unified().use(remarkGfm).use(remarkStringify, serializerOptions);

/**
 * Serialize an mdast AST to a Markdown string.
 *
 * This function produces deterministic output: the same AST will always
 * produce the same Markdown string. This is essential for:
 * - Diff computation (DEP-42): comparing serialized output
 * - Round-trip testing: `parse(serialize(ast))` should equal `ast`
 *
 * @param ast - The mdast AST to serialize
 * @returns The serialized Markdown string
 *
 * @example
 * ```ts
 * import { serialize } from '$lib/document/pipeline';
 *
 * const markdown = serialize({
 *   type: 'root',
 *   children: [
 *     { type: 'paragraph', children: [{ type: 'text', value: 'Hello' }] }
 *   ]
 * });
 * // => 'Hello\n'
 * ```
 */
export function serialize(ast: Root): string {
  return serializeProcessor.stringify(ast);
}
