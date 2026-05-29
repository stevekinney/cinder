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
import { sortKeys } from '../utilities/sort-keys.js';
import type { FrontMatterParseResult, FrontMatterSerializeOptions } from './types.js';

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
 */
export function parseFrontMatter(markdown: string): FrontMatterParseResult {
  // Handle empty/null input
  if (!markdown) {
    return {
      data: null,
      raw: null,
      body: '',
      hasFrontMatter: false,
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
    };
  }

  const segments = extractFrontMatterSegments(markdown);
  if (!segments) {
    return {
      data: null,
      raw: null,
      body: markdown,
      hasFrontMatter: false,
    };
  }

  const { raw, rawForParse, body } = segments;
  if (!rawForParse) {
    return {
      data: null,
      raw,
      body,
      hasFrontMatter: true,
    };
  }

  try {
    const parsed = parseYaml(rawForParse);
    const hasData = parsed ? Object.keys(parsed).length > 0 : false;

    return {
      data: hasData ? parsed : null,
      raw,
      body,
      hasFrontMatter: true,
    };
  } catch (error) {
    console.warn('Failed to parse front matter:', error);
    return {
      data: null,
      raw,
      body,
      hasFrontMatter: true,
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
 * Serialize front matter and body back to a complete Markdown document.
 *
 * @param data - Front matter data to serialize (null or empty object = no front matter)
 * @param body - Markdown body content
 * @param options - Serialization options
 * @returns Complete Markdown document with front matter (if data is non-empty)
 *
 * @example
 * ```ts
 * // With front matter
 * const doc = stringifyFrontMatter({ title: 'Hello' }, '# Content');
 * // => '---\ntitle: Hello\n---\n\n# Content'
 *
 * // Without front matter
 * const docNoMeta = stringifyFrontMatter(null, '# Content');
 * // => '# Content'
 * ```
 */
export function stringifyFrontMatter(
  data: Record<string, unknown> | null,
  body: string,
  options: FrontMatterSerializeOptions = {},
): string {
  const {
    preserveRaw = true,
    originalRaw,
    originalData,
    preserveEmptyFrontMatter = false,
  } = options;

  // If no data, handle based on preserveEmptyFrontMatter option
  if (!data || Object.keys(data).length === 0) {
    if (preserveEmptyFrontMatter) {
      // Preserve empty front matter block for documents that originally had it
      return `---\n---\n${body}`;
    }
    return body;
  }

  // Determine if we can preserve the original raw YAML
  let yamlContent: string;

  if (preserveRaw && originalRaw && originalData && dataEquals(data, originalData)) {
    // Data unchanged, preserve original formatting
    yamlContent = originalRaw;
  } else {
    // Generate new YAML with deterministic key ordering
    yamlContent = serializeYaml(data);
  }

  // Combine front matter and body
  // The closing delimiter needs its own line ending, then body follows
  // This preserves blank lines between front matter and content
  return `---\n${yamlContent}\n---\n${body}`;
}

/**
 * Serialize data to YAML with deterministic key ordering.
 * Keys are sorted alphabetically for consistent output.
 *
 * @param data - The data object to serialize
 * @returns The YAML string (without delimiters)
 *
 * @example
 * ```ts
 * const yaml = serializeYaml({ title: 'Hello', tags: ['a', 'b'] });
 * // "tags: [a, b]\ntitle: Hello"
 * ```
 */
export function serializeYaml(data: Record<string, unknown>): string {
  const lines: string[] = [];
  const sortedKeys = Object.keys(data).toSorted();

  for (const key of sortedKeys) {
    const value = data[key];
    lines.push(formatYamlLine(key, value));
  }

  return lines.join('\n');
}

/**
 * Format a single YAML key-value pair.
 * Handles common value types with appropriate formatting.
 */
function formatYamlLine(key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return `${key}: null`;
  }

  if (typeof value === 'boolean') {
    return `${key}: ${value}`;
  }

  if (typeof value === 'number') {
    return `${key}: ${value}`;
  }

  if (typeof value === 'string') {
    // Use quotes for strings that contain special characters or look like other types
    if (needsQuoting(value)) {
      return `${key}: "${escapeString(value)}"`;
    }
    return `${key}: ${value}`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${key}: []`;
    }
    // Simple arrays on one line if all items are simple strings
    if (value.every((item) => typeof item === 'string' && !needsQuoting(item))) {
      return `${key}: [${value.join(', ')}]`;
    }
    // Multi-line array for complex items
    const items = value.map((item) => `  - ${formatValue(item)}`).join('\n');
    return `${key}:\n${items}`;
  }

  if (isRecord(value)) {
    // For nested objects, use YAML block style
    const nested = serializeNestedObject(value, 2);
    return `${key}:\n${nested}`;
  }

  return `${key}: ${JSON.stringify(value) ?? 'null'}`;
}

/**
 * Serialize a nested object with indentation.
 */
function serializeNestedObject(obj: Record<string, unknown>, indent: number): string {
  const spaces = ' '.repeat(indent);
  const lines: string[] = [];
  const sortedKeys = Object.keys(obj).toSorted();

  for (const key of sortedKeys) {
    const value = obj[key];
    if (isRecord(value)) {
      lines.push(`${spaces}${key}:`);
      lines.push(serializeNestedObject(value, indent + 2));
    } else {
      lines.push(`${spaces}${key}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a value for inline use in YAML.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    if (needsQuoting(value)) {
      return `"${escapeString(value)}"`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(', ')}]`;
  }
  if (isRecord(value)) {
    // Serialize objects in YAML flow style: {key: value, key2: value2}
    const pairs = Object.keys(value)
      .toSorted()
      .map((k) => `${k}: ${formatValue(value[k])}`);
    return `{${pairs.join(', ')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

/**
 * Check if a string value needs quoting in YAML.
 */
function needsQuoting(value: string): boolean {
  // Empty string
  if (value === '') return true;

  // Looks like a number or boolean
  if (/^[-+]?\d*\.?\d+$/.test(value)) return true;
  if (['true', 'false', 'yes', 'no', 'on', 'off', 'null'].includes(value.toLowerCase()))
    return true;

  // Contains special characters
  if (/[:#[\]{}|>&*!?,\\"]/.test(value)) return true;

  // Starts with special characters
  if (/^[@`']/.test(value)) return true;

  // Contains newlines
  if (value.includes('\n')) return true;

  return false;
}

/**
 * Escape special characters in a string for YAML double-quoted strings.
 */
function escapeString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Deep equality check for front matter data.
 * Used to determine if original raw YAML can be preserved.
 */
function dataEquals(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

/**
 * Extract front matter and body for separate processing.
 *
 * This is a convenience wrapper around parseFrontMatter that returns
 * a tuple-like result for destructuring.
 *
 * @param markdown - The full Markdown document
 * @returns Tuple of [frontMatterData, frontMatterRaw, body]
 *
 * @example
 * ```ts
 * const [data, raw, body] = extractFrontMatter(markdown);
 * ```
 */
export function extractFrontMatter(
  markdown: string,
): [Record<string, unknown> | null, string | null, string] {
  const result = parseFrontMatter(markdown);
  return [result.data, result.raw, result.body];
}

/**
 * Check if a Markdown document has front matter.
 *
 * Front matter must be at the very beginning of the document (no leading whitespace)
 * for it to be recognized by `parseFrontMatter()`. This function mirrors that behavior
 * to ensure consistency.
 *
 * @param markdown - The Markdown document to check
 * @returns True if the document starts with `---` front matter delimiters
 */
export function hasFrontMatter(markdown: string): boolean {
  // Must start exactly at position 0, consistent with parseFrontMatter()
  return markdown.startsWith('---');
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

/**
 * Merge front matter data with new values.
 * New values override existing ones; undefined removes a key.
 *
 * @param existing - Current front matter data
 * @param updates - Values to merge (undefined = remove key)
 * @returns Merged front matter data
 */
export function mergeFrontMatter(
  existing: Record<string, unknown> | null,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...existing };

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      delete result[key];
    } else {
      result[key] = value;
    }
  }

  return result;
}
