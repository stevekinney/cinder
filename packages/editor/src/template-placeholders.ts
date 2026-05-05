/**
 * Template placeholder domain logic for saved-prompt/template authoring.
 *
 * Pure functions for JSON Schema candidate extraction, {{path}} token parsing,
 * validation against known paths, and deterministic template resolution.
 *
 * DEP-582: No ProseMirror or DOM dependencies.
 * DEP-625: For secure markdown rendering with sanitization, use renderTemplate from template-render.ts
 */

import { renderMarkdown } from '@cinder/markdown/rendering';
import { RESERVED_SEGMENTS } from './placeholder-security.js';
import type {
  PlaceholderCandidate,
  PlaceholderResolutionResult,
  PlaceholderToken,
  PlaceholderValidationIssue,
  PlaceholderValidationResult,
  PlaceholderValueKind,
} from './types.js';

/** Valid placeholder path pattern: dot-separated identifiers starting with letter or underscore */
const PATH_REGEX = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

/** Valid single path segment: one identifier (no dots) */
const SEGMENT_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate a single path segment against security rules.
 *
 * DEP-625: Central security validation to prevent prototype pollution.
 * - Blocks empty segments (e.g., from "user..name")
 * - Enforces identifier rules (must match SEGMENT_REGEX)
 * - Blocks reserved segments (case-insensitive)
 * - Blocks segments starting with '__' (dunder properties)
 *
 * Returns true if the segment is blocked (invalid), false if allowed.
 *
 * @internal - Shared by template-placeholders.ts and preview-composer.ts
 */
export function isBlockedSegment(segment: string): boolean {
  // Block empty segments (e.g., from "user..name")
  if (segment === '') {
    return true;
  }

  // Enforce identifier rules (must match SEGMENT_REGEX)
  if (!SEGMENT_REGEX.test(segment)) {
    return true;
  }

  // Block reserved segments (case-insensitive)
  if (RESERVED_SEGMENTS.has(segment.toLowerCase())) {
    return true;
  }

  // Block segments starting with '__' (dunder properties)
  // Note: SEGMENT_REGEX allows '__' prefixes (e.g., '__proto__', '__custom__')
  // since '_' is a valid identifier character. This check is the only guard
  // against arbitrary '__'-prefixed segments not in RESERVED_SEGMENTS.
  if (segment.startsWith('__')) {
    return true;
  }

  return false;
}

/**
 * Map a JSON Schema `type` value to a PlaceholderValueKind.
 * Returns 'unknown' for missing or unsupported type values.
 */
function mapSchemaTypeToValueKind(type: unknown): PlaceholderValueKind {
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    default:
      return 'unknown';
  }
}

/**
 * Traverse a nested object by dot-separated path segments.
 * Returns undefined if any segment is missing or a non-object intermediate is encountered.
 *
 * DEP-625: Hardened against prototype pollution attacks.
 * - Validates all segments before resolution using isBlockedSegment()
 * - Uses Object.hasOwn() to prevent prototype chain traversal
 *
 * This function enforces the same identifier rules as PATH_REGEX/SEGMENT_REGEX
 * to ensure resolution behavior matches validation/candidate generation.
 */
function getNestedValue(values: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');

  // Validate all segments before resolution (DEP-625)
  for (const segment of segments) {
    if (isBlockedSegment(segment)) {
      return undefined;
    }
  }

  // Traverse the path using validated segments
  let current: unknown = values;

  for (const segment of segments) {
    if (!isRecord(current)) {
      return undefined;
    }
    // Use Object.hasOwn to avoid traversing the prototype chain. Without this
    // guard, paths like "constructor" or "toString" resolve to inherited
    // functions, which JSON.stringify coerces to the literal text "undefined"
    // instead of the expected empty string.
    if (!Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

/**
 * Format a value for placeholder replacement using strict coercion rules.
 *
 * - undefined/null → ''
 * - function/symbol → '' (JSON.stringify returns undefined for these types,
 *   which string concatenation coerces to the literal text "undefined")
 * - string → unchanged
 * - number/boolean/bigint → String(value)
 * - array → map items then join(', ')
 * - object → JSON.stringify(value)
 */
function formatValueForReplacement(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  // JSON.stringify returns undefined (not a string) for function and symbol
  // values. String concatenation then coerces that to the literal text
  // "undefined" rather than the expected empty string.
  if (typeof value === 'function' || typeof value === 'symbol') {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null || item === undefined) {
          return '';
        }
        // Mirror the top-level function/symbol guard: JSON.stringify returns
        // undefined for these types, and String() produces function source code
        // or "Symbol(...)" — both inconsistent with the documented '' contract.
        if (typeof item === 'function' || typeof item === 'symbol') {
          return '';
        }
        if (typeof item === 'object') {
          return JSON.stringify(item);
        }
        return String(item);
      })
      .join(', ');
  }

  return JSON.stringify(value);
}

/**
 * Extract placeholder candidates from a JSON Schema by recursively walking `properties`.
 *
 * For each property:
 * 1. Build the dot-separated path (e.g., "input.x").
 * 2. Determine valueKind from the type field.
 * 3. Extract description (string or undefined).
 * 4. Emit a candidate for the current path.
 * 5. If the property has nested properties, recurse (regardless of explicit type: 'object').
 * 6. Silently ignore $ref, allOf, anyOf, oneOf, if/then/else, patternProperties, additionalProperties.
 *
 * Returns candidates sorted lexicographically by path.
 */
export function buildPlaceholderCandidatesFromJsonSchema(
  schema: Record<string, unknown>,
): PlaceholderCandidate[] {
  const candidates: PlaceholderCandidate[] = [];

  function walk(properties: Record<string, unknown>, prefix: string): void {
    for (const key of Object.keys(properties)) {
      // Skip keys that are not valid identifier segments — paths containing
      // non-identifier characters (e.g. "first-name", "first.name") cannot
      // be emitted as candidates because validatePlaceholderTokens would
      // reject them as invalid_path_format and resolveTemplatePlaceholders
      // would mis-resolve them by splitting on dots.
      if (!SEGMENT_REGEX.test(key)) {
        continue;
      }

      const property = properties[key];

      if (!isRecord(property)) {
        continue;
      }

      const path = prefix ? `${prefix}.${key}` : key;
      const valueKind = mapSchemaTypeToValueKind(property['type']);
      const description =
        typeof property['description'] === 'string' ? property['description'] : undefined;

      candidates.push({ path, description, valueKind });

      // Recurse into nested properties regardless of explicit type: 'object'
      if (isRecord(property['properties'])) {
        walk(property['properties'], path);
      }
    }
  }

  if (isRecord(schema['properties'])) {
    walk(schema['properties'], '');
  }

  return candidates.toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * Parse all {{...}} tokens from the given text with source offsets.
 *
 * Scans for {{ delimiters and extracts tokens with:
 * - raw: full text including delimiters
 * - path: trimmed body between delimiters
 * - startOffset/endOffset: source positions
 * - closed: whether the token has a closing }}
 *
 * Never throws for any input.
 */
export function parsePlaceholderTokens(text: string): PlaceholderToken[] {
  const tokens: PlaceholderToken[] = [];
  let position = 0;

  while (position < text.length) {
    const openIndex = text.indexOf('{{', position);

    if (openIndex === -1) {
      break;
    }

    const closeIndex = text.indexOf('}}', openIndex + 2);

    if (closeIndex !== -1) {
      const raw = text.slice(openIndex, closeIndex + 2);
      const path = raw.slice(2, -2).trim();
      tokens.push({
        raw,
        path,
        startOffset: openIndex,
        endOffset: closeIndex + 2,
        closed: true,
      });
      position = closeIndex + 2;
    } else {
      const raw = text.slice(openIndex);
      const path = raw.slice(2).trim();
      tokens.push({
        raw,
        path,
        startOffset: openIndex,
        endOffset: text.length,
        closed: false,
      });
      break;
    }
  }

  return tokens;
}

/**
 * Validate parsed tokens against a set of known placeholder candidates.
 *
 * Classifies each token as valid or invalid:
 * - Unclosed tokens → malformed_token
 * - Invalid path format → invalid_path_format
 * - Path not in candidate set → unknown_placeholder
 * - Otherwise → valid
 */
export function validatePlaceholderTokens(
  tokens: PlaceholderToken[],
  candidates: PlaceholderCandidate[],
): PlaceholderValidationResult {
  const candidatePaths = new Set(candidates.map((candidate) => candidate.path));
  const validTokens: PlaceholderToken[] = [];
  const invalidTokens: PlaceholderToken[] = [];
  const issues: PlaceholderValidationIssue[] = [];

  for (const token of tokens) {
    if (!token.closed) {
      invalidTokens.push(token);
      issues.push({ token, reason: 'malformed_token' });
    } else if (!PATH_REGEX.test(token.path)) {
      invalidTokens.push(token);
      issues.push({ token, reason: 'invalid_path_format' });
    } else if (!candidatePaths.has(token.path)) {
      invalidTokens.push(token);
      issues.push({ token, reason: 'unknown_placeholder' });
    } else {
      validTokens.push(token);
    }
  }

  return { validTokens, invalidTokens, issues };
}

/**
 * Resolve all placeholder tokens in the given text by substituting values.
 *
 * Iterates tokens in reverse order to preserve earlier offsets during string splicing.
 * Unclosed tokens are left in the text unmodified.
 * When candidatePaths is provided, unknown paths are reported as issues.
 */
export function resolveTemplatePlaceholders(
  text: string,
  values: Record<string, unknown>,
  candidatePaths?: string[],
): PlaceholderResolutionResult {
  const tokens = parsePlaceholderTokens(text);
  const candidateSet = candidatePaths ? new Set(candidatePaths) : undefined;
  const issues: PlaceholderValidationIssue[] = [];

  // Iterate in reverse to preserve offsets during splicing. Issues are
  // collected in reverse traversal order and sorted by startOffset before
  // return so downstream consumers receive them in forward document order,
  // consistent with validatePlaceholderTokens.
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (!token) continue;

    if (!token.closed) {
      continue;
    }

    const value = getNestedValue(values, token.path);
    const replacement = formatValueForReplacement(value);
    text = text.slice(0, token.startOffset) + replacement + text.slice(token.endOffset);

    if (candidateSet && !candidateSet.has(token.path) && PATH_REGEX.test(token.path)) {
      issues.push({ token, reason: 'unknown_placeholder' });
    }
  }

  // Sort issues in forward document order so callers receive a consistent
  // ordering regardless of whether they came from this function (which
  // traverses tokens in reverse) or validatePlaceholderTokens (which
  // traverses forward).
  const sortedIssues = issues.toSorted((a, b) => a.token.startOffset - b.token.startOffset);

  return { text, issues: sortedIssues };
}

/**
 * Render a template with placeholder substitution and markdown-to-HTML conversion.
 *
 * DEP-625: This function provides a secure rendering pipeline that:
 * 1. Resolves placeholders using the hardened getNestedValue() (blocks prototype pollution)
 * 2. Converts markdown to HTML using @cinder/markdown's sanitized pipeline
 * 3. Sanitizes output via rehype-sanitize (blocks XSS attacks)
 *
 * Security guarantees:
 * - Prototype pollution prevented via reserved segment blocking in getNestedValue()
 * - XSS prevented via markdown pipeline's raw HTML removal and rehype-sanitize
 * - Script tags, event handlers, and dangerous URLs are stripped
 * - Only safe HTML tags and attributes are allowed
 *
 * @param template - Template string with {{placeholder}} tokens
 * @param values - Data object for placeholder resolution
 * @returns Sanitized HTML string safe for rendering
 *
 * @example
 * ```typescript
 * const html = renderTemplate('# Hello {{name}}', { name: 'World' });
 * // Returns: '<h1>Hello World</h1>'
 *
 * const xss = renderTemplate('<script>alert(1)</script>{{user}}', { user: 'Alice' });
 * // Returns: 'Alice' (script tag removed by markdown pipeline)
 * ```
 */
export function renderTemplate(template: string, values: Record<string, unknown>): string {
  // Resolve placeholders using the hardened path resolution from Phase 1
  const { text } = resolveTemplatePlaceholders(template, values);

  // Render markdown to sanitized HTML using the secure pipeline. The sync
  // entry point intentionally does not handle KaTeX math — templates use
  // Markdown for formatting but never LaTeX, and avoiding the math pipeline
  // here keeps the editor bundle from pulling katex (~200 KB).
  const result = renderMarkdown(text);

  return result.html;
}
