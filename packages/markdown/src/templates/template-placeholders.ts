/**
 * Template placeholder domain logic for saved-prompt/template authoring.
 *
 * Headless functions for `{{path}}` token parsing, validation against a
 * declared catalog, and deterministic JSON substitution. Catalog extraction,
 * the token grammar, the Markdown-aware scanner and the strict-mode error
 * live in their own modules and are re-exported here as part of this
 * module's public surface.
 *
 * This module imports no rendering code. `renderTemplate`, which renders the
 * filled source to sanitized HTML, lives only in `template-render.ts`.
 *
 * @module
 */

import { normalizePlaceholderDefinitions } from './placeholder-catalog.js';
import {
  classifyPath,
  isPlainObject,
  readOwn,
  sortPlaceholderDiagnostics,
} from './placeholder-definition-data.js';
import { parseMarkdownPlaceholderTokens } from './placeholder-source-scanner.js';
import { PlaceholderTemplateError } from './placeholder-template-error.js';
import {
  encodeLiteralReplacement,
  formatPlaceholderValue,
  lookupPlaceholderValue,
  matchesPlaceholderTypes,
} from './placeholder-value-format.js';
import type {
  JsonObject,
  PlaceholderCandidate,
  PlaceholderDiagnostic,
  PlaceholderResolutionOptions,
  PlaceholderResolutionResult,
  PlaceholderToken,
  PlaceholderUnresolvedMode,
  PlaceholderValueMode,
} from './types.js';

export { normalizePlaceholderDefinitions } from './placeholder-catalog.js';
export { sortPlaceholderDiagnostics } from './placeholder-definition-data.js';
export { buildPlaceholderCandidatesFromJsonSchema } from './placeholder-schema-catalog.js';
export { parseMarkdownPlaceholderTokens } from './placeholder-source-scanner.js';
export { PlaceholderTemplateError } from './placeholder-template-error.js';
export { parsePlaceholderTokens, unescapePlaceholderBody } from './placeholder-token-scanner.js';

/** The codes a single token can produce, in precedence order. */
type TokenDiagnosticCode =
  | 'malformed_token'
  | 'invalid_path_format'
  | 'blocked_path'
  | 'unknown_placeholder'
  | 'missing_value'
  | 'invalid_value'
  | 'type_mismatch';

/** Token diagnostic messages. Messages describe the problem, never a value. */
const TOKEN_MESSAGES: Readonly<Record<TokenDiagnosticCode, string>> = {
  malformed_token:
    'Placeholder token is unclosed, nested, uses triple braces, or is split by Markdown formatting.',
  invalid_path_format: 'Placeholder path must be dot-separated ASCII identifiers.',
  blocked_path: 'Placeholder path contains a reserved segment.',
  unknown_placeholder: 'Placeholder path is not declared in the placeholder definitions.',
  missing_value: 'No value was supplied for this placeholder.',
  invalid_value: 'The value supplied for this placeholder is not plain JSON data.',
  type_mismatch: 'The value supplied for this placeholder does not match its declared types.',
};

function tokenIssue(token: PlaceholderToken, code: TokenDiagnosticCode): PlaceholderDiagnostic {
  return {
    code,
    message: TOKEN_MESSAGES[code],
    ...(token.kind === 'placeholder' ? { path: token.path } : {}),
    location: { kind: 'token', startOffset: token.startOffset, endOffset: token.endOffset },
  };
}

/** The first syntax or catalog check a token fails, or `undefined` when it names a declared path. */
function catalogProblem(
  token: PlaceholderToken,
  declared: ReadonlyMap<string, PlaceholderCandidate>,
): TokenDiagnosticCode | undefined {
  if (token.kind === 'malformed') return 'malformed_token';
  const pathProblem = classifyPath(token.path);
  if (pathProblem !== undefined) return pathProblem;
  return declared.has(token.path) ? undefined : 'unknown_placeholder';
}

function candidateMap(
  candidates: readonly PlaceholderCandidate[],
): ReadonlyMap<string, PlaceholderCandidate> {
  return new Map(candidates.map((candidate) => [candidate.path, candidate]));
}

/**
 * Validate parsed tokens against declared candidates.
 *
 * Each token gets at most one diagnostic, the first that applies in this
 * order: `malformed_token`, `invalid_path_format`, `blocked_path`,
 * `unknown_placeholder`. Value checks (`missing_value`, `invalid_value`,
 * `type_mismatch`) need supplied values and belong to
 * {@link resolveTemplatePlaceholders}. Diagnostics carry the token's source
 * range in a `token` location and are ordered by start offset, then code.
 *
 * @param tokens - Tokens from {@link parsePlaceholderTokens} or {@link parseMarkdownPlaceholderTokens}.
 * @param candidates - The declared catalog, normally `normalizePlaceholderDefinitions(...).candidates`.
 * @returns Ordered token diagnostics; empty when every token names a declared path.
 */
export function validatePlaceholderTokens(
  tokens: readonly PlaceholderToken[],
  candidates: readonly PlaceholderCandidate[],
): readonly PlaceholderDiagnostic[] {
  const declared = candidateMap(candidates);
  const issues: PlaceholderDiagnostic[] = [];
  for (const token of tokens) {
    const problem = catalogProblem(token, declared);
    if (problem !== undefined) issues.push(tokenIssue(token, problem));
  }
  return sortPlaceholderDiagnostics(issues);
}

interface ReadOptions {
  readonly definitions: unknown;
  readonly valueMode: PlaceholderValueMode;
  readonly unresolved: PlaceholderUnresolvedMode;
  readonly issues: readonly PlaceholderDiagnostic[];
}

/** Stands in for an accessor option so it fails validation without being invoked. */
const ACCESSOR_OPTION = Symbol('accessor option');

function readOption(options: unknown, key: string): unknown {
  if (!isPlainObject(options)) return undefined;
  const read = readOwn(options, key);
  if (read.status === 'accessor') return ACCESSOR_OPTION;
  return read.status === 'data' ? read.value : undefined;
}

/** An absent or explicitly `undefined` option takes its default; `null` stays invalid. */
function optionOrDefault(value: unknown, fallback: string): unknown {
  return value === undefined ? fallback : value;
}

function optionIssue(property: string, message: string): PlaceholderDiagnostic {
  return { code: 'invalid_option', message, location: { kind: 'configuration', property } };
}

/** Read and check the options object; invalid mode strings are reported, not guessed. */
function readResolutionOptions(options: unknown): ReadOptions {
  const issues: PlaceholderDiagnostic[] = [];
  const valueMode = optionOrDefault(readOption(options, 'valueMode'), 'text');
  const unresolved = optionOrDefault(readOption(options, 'unresolved'), 'preserve');
  if (valueMode !== 'text' && valueMode !== 'markdown') {
    issues.push(optionIssue('valueMode', 'Option "valueMode" must be "text" or "markdown".'));
  }
  if (unresolved !== 'preserve' && unresolved !== 'error') {
    issues.push(optionIssue('unresolved', 'Option "unresolved" must be "preserve" or "error".'));
  }
  return {
    definitions: readOption(options, 'definitions'),
    valueMode: valueMode === 'markdown' ? 'markdown' : 'text',
    unresolved: unresolved === 'error' ? 'error' : 'preserve',
    issues,
  };
}

type TokenResolution =
  | { readonly status: 'issue'; readonly code: TokenDiagnosticCode }
  | { readonly status: 'replaced'; readonly text: string };

/** Resolve one token to replacement text, or to its single primary issue. */
function resolveToken(
  token: PlaceholderToken,
  values: object,
  declared: ReadonlyMap<string, PlaceholderCandidate>,
  valueMode: PlaceholderValueMode,
): TokenResolution {
  const problem = catalogProblem(token, declared);
  if (problem !== undefined) return { status: 'issue', code: problem };
  const lookup = lookupPlaceholderValue(values, token.path.split('.'));
  if (lookup.status === 'missing') return { status: 'issue', code: 'missing_value' };
  const formatted = lookup.status === 'found' ? formatPlaceholderValue(lookup.value) : undefined;
  if (lookup.status !== 'found' || formatted === undefined) {
    return { status: 'issue', code: 'invalid_value' };
  }
  if (!matchesPlaceholderTypes(lookup.value, declared.get(token.path)?.types)) {
    return { status: 'issue', code: 'type_mismatch' };
  }
  const raw = formatted.kind === 'string' && valueMode === 'markdown';
  return {
    status: 'replaced',
    text: raw ? formatted.text : encodeLiteralReplacement(formatted.text),
  };
}

function finish(
  text: string,
  issues: readonly PlaceholderDiagnostic[],
  unresolved: PlaceholderUnresolvedMode,
): PlaceholderResolutionResult {
  const ordered = sortPlaceholderDiagnostics(issues);
  if (unresolved === 'error' && ordered.length > 0) throw new PlaceholderTemplateError(ordered);
  return { text, issues: ordered };
}

/**
 * Fill the declared placeholders of a Markdown template with JSON values.
 *
 * Only paths declared by `options.definitions` are substituted, and only
 * from own data properties of plain objects: inherited properties, getters,
 * `toJSON`, reserved segments and undeclared input keys never resolve.
 * Tokens are found with {@link parseMarkdownPlaceholderTokens}, so code,
 * math, HTML, URLs, front matter and other excluded contexts stay literal.
 * The output is assembled once, front to back, from the original source and
 * the replacements; replacement text is never scanned again.
 *
 * Each token gets at most one issue, in this order: `malformed_token`,
 * `invalid_path_format`, `blocked_path`, `unknown_placeholder`,
 * `missing_value` (no own property, distinct from `null`), `invalid_value`
 * (`undefined`, bigint, symbols, functions, non-finite numbers, sparse
 * arrays, accessors, cycles or non-plain objects in the referenced subtree)
 * and `type_mismatch` (against declared `types`; `integer` accepts finite
 * integers only). Invalid `valueMode` or `unresolved` strings
 * (`invalid_option`), non-plain `values` (`invalid_values`) and any
 * definitions issue disable fill: the template is returned unchanged with
 * only those issues.
 *
 * Formatting: strings are unchanged; numbers use JSON serialization (`-0`
 * becomes `0`); booleans and `null` become `true`, `false` and `null`; arrays
 * and objects become compact JSON with recursively sorted keys. In the
 * default `text` value mode every replacement is then encoded with decimal
 * character references except ASCII letters, digits and code points at or
 * above U+00A0, so it renders as literal text; in `markdown` mode string
 * values are inserted raw. The result is Markdown source, not safe HTML.
 *
 * @param template - The Markdown template source.
 * @param values - A plain object keyed by the catalog paths' first segments.
 * @param options - Required `definitions`, plus optional `valueMode` and `unresolved`.
 * @returns The filled source and ordered diagnostics, in `preserve` mode.
 * @throws {PlaceholderTemplateError} In `error` mode when there is any issue.
 */
export function resolveTemplatePlaceholders(
  template: string,
  values: JsonObject,
  options: PlaceholderResolutionOptions,
): PlaceholderResolutionResult {
  const settings = readResolutionOptions(options);
  const catalog = normalizePlaceholderDefinitions(settings.definitions);
  const configurationIssues = [...settings.issues, ...catalog.issues];
  if (!isPlainObject(values)) {
    configurationIssues.push({
      code: 'invalid_values',
      message: 'Placeholder values must be a plain object.',
      location: { kind: 'configuration', property: 'values' },
    });
  }
  if (configurationIssues.length > 0 || !catalog.enabled) {
    return finish(template, configurationIssues, settings.unresolved);
  }

  const declared = candidateMap(catalog.candidates);
  const issues: PlaceholderDiagnostic[] = [];
  const parts: string[] = [];
  let position = 0;
  for (const token of parseMarkdownPlaceholderTokens(template)) {
    const resolution = resolveToken(token, values, declared, settings.valueMode);
    if (resolution.status === 'issue') {
      issues.push(tokenIssue(token, resolution.code));
      continue;
    }
    parts.push(template.slice(position, token.startOffset), resolution.text);
    position = token.endOffset;
  }
  parts.push(template.slice(position));
  return finish(parts.join(''), issues, settings.unresolved);
}
