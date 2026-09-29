/**
 * Types for template placeholder domain logic (DEP-582).
 *
 * Split from the former `@cinder/editor` package's `types.ts`: this half is
 * the headless, DOM-free placeholder surface used by
 * `template-placeholders.ts` and `template-render.ts`. Types for the
 * ProseMirror/Milkdown editor integration itself live in
 * `@lostgradient/editor`'s `editor/types.ts`.
 */

/**
 * A JSON value type a placeholder can declare.
 *
 * `integer` is a JSON number constrained to finite integers and stays distinct
 * from `number` so callers can check integer-only placeholders. Declared type
 * lists are normalized into this enumeration order: string, number, integer,
 * boolean, null, object, array.
 */
export type PlaceholderSchemaType =
  'string' | 'number' | 'integer' | 'boolean' | 'null' | 'object' | 'array';

/**
 * One addressable placeholder path with display and type metadata.
 *
 * Metadata never carries a value: schema `default`, `examples`, `enum` and
 * `const` are not copied into a candidate.
 */
export interface PlaceholderCandidate {
  /** Dot-separated identifier path, for example `input.x`. */
  path: string;
  /**
   * Declared JSON types, deduplicated and in {@link PlaceholderSchemaType}
   * enumeration order. Omitted means unknown: any JSON type is accepted. An
   * empty list is invalid metadata.
   */
  types?: readonly PlaceholderSchemaType[];
  /** Display title from the schema `title` keyword or explicit metadata. */
  title?: string;
  /** Display description from the schema `description` keyword or explicit metadata. */
  description?: string;
}

/**
 * A JSON object keyed by strings.
 *
 * Runtime checks are stricter than this type can express: objects must be
 * plain data (see {@link normalizePlaceholderDefinitions}).
 */
export interface JsonObject {
  [key: string]: JsonValue;
}

/**
 * Any JSON value. Numbers must be finite at runtime, which TypeScript cannot
 * express.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

/**
 * A JSON Schema object supplied as placeholder definitions.
 *
 * Deliberately loose: the supported catalog subset is validated at runtime
 * rather than typed, which avoids a general JSON Schema dependency.
 */
export interface JsonSchemaObject {
  readonly [key: string]: unknown;
}

/**
 * The high-level placeholder allowlist: exactly one of a JSON Schema (the
 * recommended path) or explicit candidate metadata.
 *
 * Supplying both or neither is rejected by the type and, for untyped callers,
 * by {@link normalizePlaceholderDefinitions} with an `invalid_definitions`
 * diagnostic. An empty valid catalog permits no paths.
 */
export type PlaceholderDefinitions =
  | { readonly schema: JsonSchemaObject; readonly candidates?: never }
  | { readonly candidates: readonly PlaceholderCandidate[]; readonly schema?: never };

/**
 * Every structured placeholder diagnostic code.
 *
 * Definition and configuration codes: `invalid_definitions`,
 * `invalid_schema`, `unsupported_schema`, `cyclic_schema`,
 * `invalid_candidate`, `duplicate_candidate`, `invalid_values`,
 * `conflicting_configuration`, `invalid_option`. Path codes shared by
 * definitions and tokens: `blocked_path`, `invalid_path_format`. Token codes:
 * `malformed_token`, `unknown_placeholder`, `missing_value`, `invalid_value`,
 * `type_mismatch`.
 */
export type PlaceholderDiagnosticCode =
  | 'invalid_definitions'
  | 'invalid_schema'
  | 'unsupported_schema'
  | 'cyclic_schema'
  | 'invalid_candidate'
  | 'duplicate_candidate'
  | 'blocked_path'
  | 'invalid_path_format'
  | 'malformed_token'
  | 'unknown_placeholder'
  | 'missing_value'
  | 'invalid_value'
  | 'type_mismatch'
  | 'invalid_values'
  | 'conflicting_configuration'
  | 'invalid_option';

/**
 * Where a diagnostic applies.
 *
 * - `definition`: an RFC 6901 JSON Pointer relative to the definitions
 *   object, such as `/schema/properties/user/properties/name` or
 *   `/candidates/0/types`. The root is `''`.
 * - `token`: a zero-based, end-exclusive UTF-16 range in the original source.
 * - `configuration`: the option or component property at fault, such as
 *   `definitions`, `values`, `valueMode`, `unresolved` or `mode`.
 */
export type PlaceholderDiagnosticLocation =
  | { readonly kind: 'definition'; readonly pointer: string }
  | { readonly kind: 'token'; readonly startOffset: number; readonly endOffset: number }
  | { readonly kind: 'configuration'; readonly property: string };

/**
 * A structured placeholder problem. Diagnostics describe metadata locations
 * and never include substituted or supplied values.
 */
export interface PlaceholderDiagnostic {
  /** Machine-readable problem code. */
  readonly code: PlaceholderDiagnosticCode;
  /** Human-readable explanation that contains no supplied values. */
  readonly message: string;
  /** The placeholder path concerned, when one applies. */
  readonly path?: string;
  /** Where the problem was found. */
  readonly location: PlaceholderDiagnosticLocation;
}

/**
 * Candidates and definition diagnostics extracted from placeholder
 * definitions. `candidates` holds every valid entry, sorted by path in
 * code-unit order, even when `issues` is non-empty.
 */
export interface PlaceholderCatalogResult {
  /** Valid candidates sorted by path in code-unit order. */
  readonly candidates: readonly PlaceholderCandidate[];
  /** Ordered, deduplicated definition diagnostics. */
  readonly issues: readonly PlaceholderDiagnostic[];
}

/**
 * The result of normalizing {@link PlaceholderDefinitions} once.
 *
 * Any diagnostic disables the whole high-level catalog for completion and
 * fill: `enabled` is `false` whenever `issues` is non-empty. `candidates`
 * still lists the valid partial entries so callers can explain the problem,
 * but must not be used as the allowlist while `enabled` is `false`.
 */
export interface NormalizedPlaceholderDefinitions extends PlaceholderCatalogResult {
  /** `true` only when there are no issues and the catalog may be used. */
  readonly enabled: boolean;
}

/**
 * A parsed `{{...}}` token with original source offsets.
 *
 * `kind` is `placeholder` for a syntactically complete token, whose `path`
 * may still fail validation, and `malformed` for an unclosed token or a
 * nested or triple-brace span.
 */
export interface PlaceholderToken {
  /** The full raw source text of the token, including delimiters (e.g. `{{ input.x }}`). */
  raw: string;
  /**
   * The body without surrounding spaces or tabs. For a malformed token it is
   * the text after an unclosed opener, or empty for a nested or triple-brace span.
   */
  path: string;
  /** Zero-based, inclusive UTF-16 start offset in the original source. */
  startOffset: number;
  /** Zero-based, exclusive UTF-16 end offset in the original source. */
  endOffset: number;
  /** Whether the token is syntactically complete or malformed. */
  kind: 'placeholder' | 'malformed';
}

/**
 * How replacement values enter the filled Markdown source.
 *
 * - `text` (default): every replacement is encoded with character
 *   references so it renders as literal text.
 * - `markdown`: string values are inserted raw and may add Markdown
 *   structure; every other JSON value still uses the literal encoding.
 */
export type PlaceholderValueMode = 'text' | 'markdown';

/**
 * What happens when any issue is found.
 *
 * - `preserve` (default): unresolved tokens stay in the output unchanged and
 *   the issues are returned.
 * - `error`: throw a {@link PlaceholderTemplateError} with the issues and no
 *   partial result.
 */
export type PlaceholderUnresolvedMode = 'preserve' | 'error';

/** Required options for placeholder resolution and template rendering. */
export interface PlaceholderResolutionOptions {
  /** The allowlist of fillable paths; only declared paths are ever substituted. */
  readonly definitions: PlaceholderDefinitions;
  /** How replacement values enter the output. Defaults to `'text'`. */
  readonly valueMode?: PlaceholderValueMode;
  /** How unresolved tokens and other issues are handled. Defaults to `'preserve'`. */
  readonly unresolved?: PlaceholderUnresolvedMode;
}

/** Output from `resolveTemplatePlaceholders` in preserve mode. */
export interface PlaceholderResolutionResult {
  /** The filled Markdown source; unresolved tokens keep their original text. */
  readonly text: string;
  /** Ordered, deduplicated diagnostics that never include supplied values. */
  readonly issues: readonly PlaceholderDiagnostic[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder completion & decoration configuration (DEP-583)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for the placeholder completion menu in WYSIWYG mode.
 *
 * When provided, the editor shows an inline suggestion popup as the user
 * types inside `{{…}}` tokens.
 */
export interface PlaceholderCompletionConfiguration {
  /** Static candidate paths available for completion */
  candidates: PlaceholderCandidate[];

  /**
   * Optional async lookup for additional candidates.
   * Called after `lookupDebounceMs` with the current query text.
   * The signal is aborted when the query changes or the menu closes.
   */
  lookupCandidates?: (query: string, signal: AbortSignal) => Promise<PlaceholderCandidate[]>;

  /** Minimum query length before showing suggestions (default: 1) */
  minimumQueryLength?: number;

  /** Debounce interval for async lookup calls in ms (default: 150) */
  lookupDebounceMs?: number;
}

/**
 * Configuration for invalid-token decoration in WYSIWYG mode.
 *
 * When provided, the editor decorates `{{…}}` tokens that fail validation
 * with a CSS class and a data attribute describing the failure reason.
 */
export interface PlaceholderDecorationConfiguration {
  /** Known candidates used for validation */
  candidates: PlaceholderCandidate[];

  /** CSS class applied to invalid tokens (default: 'template-placeholder-invalid') */
  invalidClassName?: string;
}
