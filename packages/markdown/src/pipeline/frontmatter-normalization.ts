import { sortKeys } from '../utilities/sort-keys.js';
import { contentEquals, normalize } from './ast.js';
import { stringifyFrontMatter } from './frontmatter-serializer.js';
import { parseFrontMatter } from './frontmatter.js';

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
  const { data, raw, body, hasFrontMatter } = parseFrontMatter(markdown);

  // Normalize the body content
  const normalizedBody = normalize(body);

  // No fence at all, or a `---`-opening span that isn't valid front matter:
  // `body` already is the whole document in the rejected case, so there's
  // nothing else to recombine.
  if (!hasFrontMatter) {
    return normalizedBody;
  }

  if (!data) {
    // `hasFrontMatter: true` with `data: null` covers two different cases
    // that `parseFrontMatter` deliberately can't tell apart: a genuinely
    // blank block (`raw === null`, nothing to preserve) and a comment-only
    // block (`raw` holds the actual `#`-prefixed text). A comment-only span
    // can collide with ordinary Markdown that happens to be all ATX
    // headings (`# Title\n## Subtitle`) -- ambiguous the same way a list vs.
    // a YAML sequence is, and unlike that case there's no object-shape test
    // to disambiguate it, since neither reading produces YAML data. Rather
    // than guess, preserve `raw` verbatim inside the re-wrapped fence: no
    // content is ever silently dropped regardless of which reading was
    // intended (cinder#1330 round-6 finding). This mirrors the round-5
    // precedent for genuinely-invalid front matter losing its dedicated
    // recovery affordance without losing the underlying bytes.
    return raw ? `---\n${raw}\n---\n${normalizedBody}` : normalizedBody;
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

  // `data` equality alone can't see a comment-only front-matter span (`data`
  // is `null` on both sides regardless of what the comment text says), so
  // two documents differing only in that text would otherwise compare equal
  // -- the same silent-drop failure mode `normalizeWithFrontMatter` had,
  // just surfacing as a false "unchanged" instead of missing content
  // (cinder#1330 round-6 finding). Compare `raw` byte-for-byte whenever
  // neither side has data: it's opaque text at this point (we don't know if
  // it's meant as YAML comments or collided-with Markdown), so no
  // normalization is applied to it, same as `normalizeWithFrontMatter`'s
  // verbatim preservation. This is intentionally conservative in one
  // direction: `---\n{}\n---` (`raw: '{}'`) no longer compares equal to
  // `---\n---` (`raw: null`), even though both have `data: null` -- a
  // spurious "changed" rather than a missed change, which is the safe side
  // to be wrong on here.
  if (!parsedA.data && !parsedB.data && parsedA.raw !== parsedB.raw) {
    return false;
  }

  // Compare body content
  return contentEquals(parsedA.body, parsedB.body);
}
