/**
 * AST utility functions for comparison, validation, and round-trip testing.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 * DEP-61: Front matter (YAML) parsing and editing support
 *
 * @module
 */

import type { Nodes, Root } from 'mdast';
import { visit } from 'unist-util-visit';
import { sortKeys } from '../utilities/sort-keys.js';
import { parseFrontMatter, stringifyFrontMatter } from './frontmatter.js';
import { parseOrThrow } from './parser.js';
import { serialize } from './serializer.js';
import { stripPositions } from './strip-positions.js';

// Re-export stripPositions for backwards compatibility
export { stripPositions } from './strip-positions.js';

/**
 * Deep equality check for AST nodes, ignoring position data.
 *
 * This is used for round-trip testing: two ASTs are semantically equivalent
 * if they have the same structure and content, regardless of source positions.
 *
 * @param a - First AST to compare
 * @param b - Second AST to compare
 * @returns True if the ASTs are semantically equivalent
 *
 * @example
 * ```ts
 * import { astEquals, parseOrThrow, serialize } from '$lib/document/pipeline';
 *
 * const original = parseOrThrow('# Hello');
 * const roundTripped = parseOrThrow(serialize(original));
 *
 * console.log(astEquals(original, roundTripped)); // true
 * ```
 */
export function astEquals(a: Root, b: Root): boolean {
  return JSON.stringify(stripPositions(a)) === JSON.stringify(stripPositions(b));
}

/**
 * Validate that all nodes in an AST have position data.
 *
 * Position data is required for:
 * - Comment anchoring (DEP-39)
 * - Diff computation (DEP-42)
 *
 * @param ast - The AST to validate
 * @returns Array of issues (empty if all nodes have positions)
 *
 * @example
 * ```ts
 * import { validatePositions, parseOrThrow } from '$lib/document/pipeline';
 *
 * const ast = parseOrThrow('# Hello');
 * const issues = validatePositions(ast);
 *
 * if (issues.length > 0) {
 *   console.error('Missing positions:', issues);
 * }
 * ```
 */
export function validatePositions(ast: Root): { type: string; index: number | null }[] {
  const issues: { type: string; index: number | null }[] = [];

  visit(ast, (node: Nodes, index) => {
    if (!node.position) {
      issues.push({
        type: node.type,
        index: index ?? null,
      });
    }
  });

  return issues;
}

/**
 * Result of a round-trip test.
 */
export interface RoundTripResult {
  /** Whether the round-trip preserved semantic equivalence */
  passes: boolean;

  /** The original parsed AST */
  original: Root;

  /** The serialized Markdown */
  serialized: string;

  /** The re-parsed AST after serialization */
  roundTripped: Root;
}

/**
 * Test round-trip fidelity of a Markdown string.
 *
 * Verifies that: `parse(serialize(parse(markdown)))` is semantically
 * equivalent to `parse(markdown)`.
 *
 * @param markdown - The Markdown string to test
 * @returns Result object with pass/fail status and intermediate values
 *
 * @example
 * ```ts
 * import { roundTrip } from '$lib/document/pipeline';
 *
 * const result = roundTrip('# Hello *world*');
 *
 * if (result.passes) {
 *   console.log('Round-trip successful!');
 * } else {
 *   console.log('Original:', result.original);
 *   console.log('Serialized:', result.serialized);
 *   console.log('Round-tripped:', result.roundTripped);
 * }
 * ```
 */
export function roundTrip(markdown: string): RoundTripResult {
  const original = parseOrThrow(markdown);
  const serialized = serialize(original);
  const roundTripped = parseOrThrow(serialized);

  return {
    passes: astEquals(original, roundTripped),
    original,
    serialized,
    roundTripped,
  };
}

/**
 * Get a human-readable summary of AST differences.
 *
 * Useful for debugging when round-trip tests fail.
 *
 * @param a - First AST
 * @param b - Second AST
 * @returns A string describing the differences, or null if equal
 */
export function diffAsts(a: Root, b: Root): string | null {
  const aStripped = stripPositions(a);
  const bStripped = stripPositions(b);

  const aJson = JSON.stringify(aStripped, null, 2);
  const bJson = JSON.stringify(bStripped, null, 2);

  if (aJson === bJson) {
    return null;
  }

  // Simple diff: just return both for manual comparison
  return `ASTs differ:\n\nFirst:\n${aJson}\n\nSecond:\n${bJson}`;
}

/**
 * Normalize a Markdown string to its canonical form.
 *
 * This function parses the Markdown and re-serializes it using the
 * deterministic serializer. The result is guaranteed to be in a
 * consistent format, making it suitable for diffing.
 *
 * Additionally, this normalizes whitespace to handle differences between
 * tight/loose lists (Milkdown adds blank lines between list items, while
 * hand-written markdown often doesn't).
 *
 * Use this when comparing markdown from different sources (e.g.,
 * comparing a hand-written baseline against editor-serialized content).
 *
 * @param markdown - The Markdown string to normalize
 * @returns The normalized Markdown string
 *
 * @example
 * ```ts
 * import { normalize } from '$lib/document/pipeline';
 *
 * // These might be formatted differently but are semantically equivalent
 * const original = '* item 1\n* item 2';
 * const edited = '- item 1\n- item 2';
 *
 * console.log(normalize(original) === normalize(edited)); // true
 * ```
 */
export function normalize(markdown: string): string {
  // Fast path for empty content
  if (!markdown.trim()) {
    return '\n';
  }
  const ast = parseOrThrow(markdown);
  const serialized = serialize(ast);

  // Normalize whitespace to handle tight/loose list differences.
  // Milkdown creates loose lists (blank lines between items),
  // while hand-written markdown is often tight.
  //
  // Strategy: Remove blank lines between list items while preserving
  // paragraph breaks elsewhere.
  return (
    serialized
      // Remove blank lines between list items (unordered: -, *, +)
      .replace(/^([-*+] .*)$\n\n(?=[-*+] )/gm, '$1\n')
      // Remove blank lines between ordered list items (1., 2., etc.)
      .replace(/^(\d+\. .*)$\n\n(?=\d+\. )/gm, '$1\n')
      // Collapse 3+ newlines to 2 (paragraph breaks)
      .replace(/\n{3,}/g, '\n\n')
      // Clean up leading/trailing whitespace
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n')
  );
}

// =========================================================================
// Cached Normalization (DEP-47 Performance Optimization)
// =========================================================================

/**
 * LRU-style cache for normalized content.
 * Keeps the most recently normalized strings to avoid redundant parse/serialize.
 */
const normalizeCache = new Map<string, string>();
const MAX_CACHE_SIZE = 10;

/**
 * Normalize a Markdown string with caching.
 *
 * This is the same as `normalize()` but caches results to avoid
 * redundant parse/serialize operations. Use this for:
 * - Diff computation where baseline doesn't change frequently
 * - Change detection where same content is checked repeatedly
 *
 * Cache behavior:
 * - LRU-style: keeps last 10 entries
 * - Key: raw input string
 * - Value: normalized output string
 *
 * @param markdown - The Markdown string to normalize
 * @returns The normalized Markdown string
 *
 * @example
 * ```ts
 * import { normalizeWithCache } from '$lib/document/pipeline';
 *
 * const baseline = '# Document\n\nContent here...';
 *
 * // First call: full normalization (~20ms for 20KB)
 * const normalized1 = normalizeWithCache(baseline);
 *
 * // Second call: cache hit (~0ms)
 * const normalized2 = normalizeWithCache(baseline);
 * ```
 */
export function normalizeWithCache(markdown: string): string {
  // Check cache first
  const cached = normalizeCache.get(markdown);
  if (cached !== undefined) {
    return cached;
  }

  // Compute normalization
  const result = normalize(markdown);

  // Add to cache with LRU eviction
  if (normalizeCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first key in Map iteration order)
    const firstKey = normalizeCache.keys().next().value;
    if (firstKey !== undefined) {
      normalizeCache.delete(firstKey);
    }
  }
  normalizeCache.set(markdown, result);

  return result;
}

/**
 * Clear the normalization cache.
 * Useful for testing or when memory pressure is high.
 */
export function clearNormalizeCache(): void {
  normalizeCache.clear();
}

/**
 * Compare two Markdown strings for semantic equality.
 *
 * Returns true if both strings, when normalized, produce identical output.
 * This is the correct way to check for "unsaved changes" when comparing
 * editor content against a baseline.
 *
 * @param a - First Markdown string
 * @param b - Second Markdown string
 * @returns True if the content is semantically equivalent
 *
 * @example
 * ```ts
 * import { contentEquals } from '$lib/document/pipeline';
 *
 * // Same content, different formatting
 * const baseline = '# Hello\nWorld';
 * const edited = '# Hello\nWorld\n';  // Editor adds trailing newline
 *
 * console.log(baseline === edited);        // false (raw comparison)
 * console.log(contentEquals(baseline, edited)); // true (semantic comparison)
 * ```
 */
export function contentEquals(a: string, b: string): boolean {
  // Fast path: identical strings
  if (a === b) return true;

  // Compare normalized forms
  return normalize(a) === normalize(b);
}

// =========================================================================
// Front Matter Support (DEP-61)
// =========================================================================

/**
 * Result of a round-trip test with front matter.
 */
export interface RoundTripWithFrontMatterResult {
  /** Whether the round-trip preserved semantic equivalence */
  passes: boolean;

  /** The original front matter data */
  originalFrontMatter: Record<string, unknown> | null;

  /** The original front matter raw YAML */
  originalFrontMatterRaw: string | null;

  /** The original body content */
  originalBody: string;

  /** The serialized (normalized) full document */
  serialized: string;

  /** The re-parsed front matter data */
  roundTrippedFrontMatter: Record<string, unknown> | null;

  /** The re-parsed front matter raw YAML */
  roundTrippedFrontMatterRaw: string | null;

  /** The re-parsed body content */
  roundTrippedBody: string;
}

/**
 * Normalize a Markdown document with front matter.
 *
 * This function:
 * 1. Parses front matter (if present) and body separately
 * 2. Normalizes the body using the standard pipeline
 * 3. Serializes the front matter with deterministic key ordering
 * 4. Recombines them into a normalized document
 *
 * @param markdown - The full Markdown document (may include front matter)
 * @returns The normalized Markdown document
 *
 * @example
 * ```ts
 * import { normalizeWithFrontMatter } from '$lib/document/pipeline';
 *
 * const doc = `---
 * title: Hello
 * author: Jane
 * ---
 *
 * # Content`;
 *
 * const normalized = normalizeWithFrontMatter(doc);
 * // Front matter keys are sorted alphabetically
 * // Body is normalized using standard pipeline
 * ```
 */
export function normalizeWithFrontMatter(markdown: string): string {
  const { data, body, hasFrontMatter } = parseFrontMatter(markdown);

  // Normalize the body content
  const normalizedBody = normalize(body);

  // If no front matter, return normalized body
  if (!hasFrontMatter || !data) {
    return normalizedBody;
  }

  // Serialize front matter with deterministic ordering and recombine
  return stringifyFrontMatter(data, normalizedBody, { preserveRaw: false });
}

/**
 * Test round-trip fidelity of a Markdown document with front matter.
 *
 * Verifies that parsing, normalizing, and re-parsing a document
 * preserves both the front matter data and body content.
 *
 * @param markdown - The Markdown document to test
 * @returns Result object with pass/fail status and intermediate values
 *
 * @example
 * ```ts
 * import { roundTripWithFrontMatter } from '$lib/document/pipeline';
 *
 * const result = roundTripWithFrontMatter(`---
 * title: Test
 * ---
 *
 * # Hello *world*`);
 *
 * if (result.passes) {
 *   console.log('Round-trip successful!');
 * }
 * ```
 */
export function roundTripWithFrontMatter(markdown: string): RoundTripWithFrontMatterResult {
  // Parse original document
  const originalParsed = parseFrontMatter(markdown);

  // Normalize the full document
  const serialized = normalizeWithFrontMatter(markdown);

  // Re-parse the normalized document
  const roundTrippedParsed = parseFrontMatter(serialized);

  // Compare front matter data (ignoring key order)
  const frontMatterEqual = frontMatterDataEquals(originalParsed.data, roundTrippedParsed.data);

  // Compare normalized body content
  const bodyEqual = contentEquals(originalParsed.body, roundTrippedParsed.body);

  return {
    passes: frontMatterEqual && bodyEqual,
    originalFrontMatter: originalParsed.data,
    originalFrontMatterRaw: originalParsed.raw,
    originalBody: originalParsed.body,
    serialized,
    roundTrippedFrontMatter: roundTrippedParsed.data,
    roundTrippedFrontMatterRaw: roundTrippedParsed.raw,
    roundTrippedBody: roundTrippedParsed.body,
  };
}

/**
 * Compare two front matter data objects for semantic equality.
 * Handles null values and compares by JSON serialization with sorted keys.
 */
function frontMatterDataEquals(
  a: Record<string, unknown> | null,
  b: Record<string, unknown> | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;

  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

/**
 * Compare two Markdown documents with front matter for semantic equality.
 *
 * Returns true if both:
 * - Front matter data is semantically equivalent (ignoring key order)
 * - Body content is semantically equivalent (using standard normalize)
 *
 * @param a - First Markdown document
 * @param b - Second Markdown document
 * @returns True if both documents are semantically equivalent
 *
 * @example
 * ```ts
 * import { contentEqualsWithFrontMatter } from '$lib/document/pipeline';
 *
 * const doc1 = `---
 * title: Hello
 * author: Jane
 * ---
 *
 * # Content`;
 *
 * const doc2 = `---
 * author: Jane
 * title: Hello
 * ---
 *
 * # Content
 * `;
 *
 * console.log(contentEqualsWithFrontMatter(doc1, doc2)); // true
 * ```
 */
export function contentEqualsWithFrontMatter(a: string, b: string): boolean {
  // Fast path: identical strings
  if (a === b) return true;

  // Parse both documents
  const parsedA = parseFrontMatter(a);
  const parsedB = parseFrontMatter(b);

  // Compare front matter data
  if (!frontMatterDataEquals(parsedA.data, parsedB.data)) {
    return false;
  }

  // Compare body content
  return contentEquals(parsedA.body, parsedB.body);
}
