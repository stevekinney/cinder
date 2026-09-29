/**
 * YAML Front Matter Parsing and Serialization
 *
 * DEP-61: Front matter (YAML) parsing and editing support
 *
 * This module provides functions for parsing and serializing YAML front matter
 * in Markdown documents. Front matter is a YAML block at the start of a document
 * delimited by `---` markers.
 *
 * @module
 */

import { JSON_SCHEMA, load } from 'js-yaml';
import type { FrontMatterParseResult } from './types.js';

/**
 * Safe YAML parsing options.
 *
 * Uses JSON_SCHEMA which only allows core JSON types (strings, numbers,
 * booleans, null, arrays, objects). This prevents code execution via
 * malicious YAML tags like !!js/function.
 */
const SAFE_YAML_OPTIONS = { schema: JSON_SCHEMA };

type FrontMatterSegments = {
  raw: string | null;
  rawForParse: string | null;
  body: string;
};

/**
 * Narrow an unknown value to a plain key/value record.
 *
 * Excludes `null` and arrays so callers can index string keys safely. YAML and
 * JSON both produce these three "object-ish" shapes, so the array check is the
 * one that actually matters here.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripSingleLeadingNewline(value: string): string {
  if (value.startsWith('\r\n')) {
    return value.slice(2);
  }
  if (value.startsWith('\n') || value.startsWith('\r')) {
    return value.slice(1);
  }
  return value;
}

function parseYaml(raw: string): Record<string, unknown> | null {
  const parsed = load(raw, SAFE_YAML_OPTIONS);

  // YAML can parse to primitives (string, number, boolean), null, or arrays,
  // but front matter must be a key/value object.
  if (!isRecord(parsed)) {
    return null;
  }

  return parsed;
}

/**
 * True if every line of `raw` is blank or a full-line YAML comment (`#...`,
 * possibly indented).
 *
 * A `---`-delimited block containing only comments (`---\n# TODO: fill in\n---`)
 * is the usual idiom for "an intentionally empty front-matter block with a
 * note," and is valid YAML -- but `load()` returns `null` for it, the exact
 * same value it returns for a document that's genuinely blank between the
 * delimiters. Without this check, `parseYaml` returning `null` for
 * comment-only content fell into the *rejected* branch below (treated as
 * "not front matter at all," the same as a Markdown list or a bare scalar),
 * which is wrong for the common "empty block with a note" idiom.
 *
 * This *is* ambiguous with ordinary Markdown, though, in exactly the way a
 * sequence or scalar is: `# Title\n## Subtitle` between two `---` lines is
 * simultaneously valid as "nothing but YAML comments" and as two ordinary
 * ATX headings sandwiched between thematic breaks (cinder#1330 round-6
 * finding). Unlike the object-shape test above, there's no content-shape
 * signal that resolves this one -- both readings produce the same `data:
 * null`. This function doesn't try to guess; `parseFrontMatter` classifies
 * comment-only content as front matter either way, and
 * `normalizeWithFrontMatter`/`contentEqualsWithFrontMatter` preserve and
 * compare the raw text verbatim rather than dropping it, so misclassifying
 * ATX headings as a comment-only block costs a display affordance (they
 * round-trip as part of the front-matter span, not as rendered headings),
 * never the underlying bytes.
 *
 * Only *full*-line comments are recognized (a line whose trimmed content
 * starts with `#`); a line like `title: Hello # a note` has a real value
 * before its `#`, so it doesn't start with one and correctly isn't treated
 * as comment-only. This is a deliberately narrow, line-oriented check, not
 * a general YAML-comment-aware scan (which would also need to reason about
 * `#` inside quoted strings) -- it only has to distinguish "nothing but
 * comments" from "real content," not parse comments in general.
 */
function isCommentOnlyYaml(raw: string): boolean {
  return raw.split('\n').every((line) => {
    const trimmed = line.trim();
    return trimmed === '' || trimmed.startsWith('#');
  });
}

function extractFrontMatterSegments(markdown: string): FrontMatterSegments | null {
  if (!markdown.startsWith('---')) {
    return null;
  }

  const firstLineEnd = markdown.indexOf('\n');
  if (firstLineEnd === -1) {
    // Document is just "---" with no newline - not valid front matter
    // Return null to treat entire document as body
    return null;
  }

  const afterFirstLine = markdown.slice(firstLineEnd + 1);
  // Match closing delimiter with optional carriage return for Windows line endings
  const closingMatch = afterFirstLine.match(/^---[ \t]*\r?$/m);

  if (!closingMatch || closingMatch.index === undefined) {
    // No closing delimiter found - treat entire document as body (no front matter)
    // Returning null causes the caller to use the entire markdown as body
    return null;
  }

  const rawSection = afterFirstLine.slice(0, closingMatch.index);
  const raw = rawSection.trim();

  const closingStart = firstLineEnd + 1 + closingMatch.index;
  const closingEnd = closingStart + closingMatch[0].length;
  const body = stripSingleLeadingNewline(markdown.slice(closingEnd));

  return {
    raw: raw || null,
    rawForParse: raw || null,
    body,
  };
}

/**
 * Parse YAML front matter from a Markdown document.
 *
 * Front matter must be at the very start of the document, delimited by `---`:
 *
 * ```markdown
 * ---
 * title: My Document
 * date: 2025-01-04
 * ---
 *
 * # Content starts here
 * ```
 *
 * The content between the delimiters must actually parse as YAML *and* be
 * object-shaped (a key/value mapping) for the document to count as having
 * front matter. A `---`-opening span whose content is invalid YAML, or valid
 * YAML that isn't object-shaped (a bare scalar, a sequence, `null`), is not
 * front matter -- `hasFrontMatter` comes back `false` and the entire
 * document (delimiters included) is returned as `body`, the same as when no
 * closing delimiter is found at all. This matters because Markdown list
 * markers (`- one`) are also valid YAML sequences, and two documents that
 * differ only in list-marker style (`* one` vs `- one`) must be recognized
 * as ordinary Markdown, not as two different "front matter" blocks.
 *
 * @param markdown - The full Markdown document (may or may not contain front matter)
 * @returns Parsed result with data, raw YAML, and body content
 *
 * @example
 * ```ts
 * const result = parseFrontMatter('---\ntitle: Hello\n---\n\n# Content');
 * console.log(result.data);           // { title: 'Hello' }
 * console.log(result.raw);            // 'title: Hello'
 * console.log(result.body);           // '\n# Content'
 * console.log(result.hasFrontMatter); // true
 * ```
 *
 * @example
 * ```ts
 * // Not front matter: valid YAML, but a sequence rather than a mapping.
 * const result = parseFrontMatter('---\n- one\n- two\n---\n\nBody.');
 * console.log(result.hasFrontMatter); // false
 * console.log(result.body);           // '---\n- one\n- two\n---\n\nBody.'
 * ```
 */
export function parseFrontMatter(markdown: string): FrontMatterParseResult {
  // Handle empty/null input
  if (!markdown) {
    return {
      data: null,
      raw: null,
      body: '',
      hasFrontMatter: false,
      fencePresent: false,
    };
  }

  // Check if document starts with front matter delimiter
  // Front matter must be at the very start (no leading whitespace)
  if (!markdown.startsWith('---')) {
    return {
      data: null,
      raw: null,
      body: markdown,
      hasFrontMatter: false,
      fencePresent: false,
    };
  }

  const segments = extractFrontMatterSegments(markdown);
  if (!segments) {
    // Leading `---` but no matching closing `---` -- there's no well-formed
    // fenced span here at all (this `---` is ordinary document content,
    // e.g. a thematic break), so `fencePresent` is `false` too: prepending
    // a new front-matter block onto text like this doesn't collide with
    // anything a reader would recognize as an existing fence.
    return {
      data: null,
      raw: null,
      body: markdown,
      hasFrontMatter: false,
      fencePresent: false,
    };
  }

  // From here on, a well-formed `---`...`---` span was found -- `fencePresent`
  // is `true` regardless of whether its content turns out to be valid front
  // matter, since a caller deciding "is it safe to prepend a new fence here"
  // cares about the span existing, not about what's inside it.
  const { raw, rawForParse, body } = segments;
  if (!rawForParse) {
    // Blank/whitespace-only content between the delimiters is an
    // intentionally empty front-matter block (`---\n---\n`), not a parse
    // failure -- there's no YAML there to be invalid, so this stays
    // front matter with no data (cinder#1325 doesn't apply here).
    return {
      data: null,
      raw,
      body,
      hasFrontMatter: true,
      fencePresent: true,
    };
  }

  try {
    const parsed = parseYaml(rawForParse);

    if (!parsed) {
      // `parseYaml` returns null both for YAML that parsed but isn't
      // object-shaped (a bare scalar, a sequence, or explicit `null`) *and*
      // for content that's nothing but comments -- `load()` can't tell
      // those apart, but they aren't the same case. Comment-only content is
      // the "empty block with a note" idiom (see `isCommentOnlyYaml`), not
      // ordinary Markdown that happens to look front-matter-shaped, so it
      // gets the same "empty, still front matter" treatment the
      // whitespace-only case above already gets. A real sequence or scalar
      // -- content that could just as easily be a Markdown list or a plain
      // paragraph bracketed by two thematic breaks -- still isn't front
      // matter, same as before.
      if (isCommentOnlyYaml(rawForParse)) {
        return {
          data: null,
          raw,
          body,
          hasFrontMatter: true,
          fencePresent: true,
        };
      }

      // This `---`-opening span was never front matter -- it's ordinary
      // document content (often a thematic break, some other block, and a
      // second thematic break) that happens to look front-matter-shaped.
      // Treat the whole document as body, same as "no closing delimiter".
      // `fencePresent: true`, though, since a well-formed `---`...`---` span
      // really is there -- a caller deciding whether it's safe to prepend a
      // *new* fence onto this text needs to know that, even though this one
      // isn't valid front matter (cinder#1324/#1325 follow-up).
      return {
        data: null,
        raw: null,
        body: markdown,
        hasFrontMatter: false,
        fencePresent: true,
      };
    }

    const hasData = Object.keys(parsed).length > 0;

    return {
      data: hasData ? parsed : null,
      raw,
      body,
      hasFrontMatter: true,
      fencePresent: true,
    };
  } catch {
    // Content between the delimiters doesn't parse as YAML at all (e.g. an
    // unclosed bracket, an unresolvable alias reference). Also not front
    // matter, for the same reason as the non-record case above -- and
    // `fencePresent: true` for the same reason too.
    return {
      data: null,
      raw: null,
      body: markdown,
      hasFrontMatter: false,
      fencePresent: true,
    };
  }
}

/**
 * Parse front matter and return a normalized block view.
 * Includes a preformatted front matter text block (with delimiters) for diffing.
 */
export interface FrontMatterBlock extends FrontMatterParseResult {
  /** Front matter block text with delimiters (empty string if none) */
  text: string;
}

export function getFrontMatterBlock(markdown: string): FrontMatterBlock {
  const parsed = parseFrontMatter(markdown);
  const text = parsed.hasFrontMatter ? `---\n${parsed.raw ?? ''}\n---` : '';

  return {
    ...parsed,
    text,
  };
}

/**
 * Validate YAML front matter syntax.
 *
 * @param raw - Raw YAML string (without delimiters)
 * @returns Object with `valid` boolean and optional `error` message
 */
export function validateFrontMatter(raw: string): { valid: boolean; error?: string } {
  if (!raw.trim()) {
    return { valid: true };
  }

  try {
    // Parse with safe schema to validate syntax consistently with parseFrontMatter.
    load(raw, SAFE_YAML_OPTIONS);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid YAML syntax',
    };
  }
}
