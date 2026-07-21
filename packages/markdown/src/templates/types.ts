/**
 * Types for template placeholder domain logic (DEP-582).
 *
 * Split from the former `@cinder/editor` package's `types.ts`: this half is
 * the headless, DOM-free placeholder surface used by
 * `template-placeholders.ts` and `template-render.ts`. Types for the
 * ProseMirror/Milkdown editor integration itself live in
 * `@cinder/commentary`'s `editor/types.ts`.
 */

/** Value kind inferred from JSON Schema type field */
export type PlaceholderValueKind = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'unknown';

/** A single candidate path extracted from a JSON Schema */
export interface PlaceholderCandidate {
  /** Dot-separated property path (e.g., "input.x") */
  path: string;
  /** Schema description, if present */
  description: string | undefined;
  /** Inferred value kind from the schema type field */
  valueKind: PlaceholderValueKind;
}

/** A parsed {{...}} token with source offsets */
export interface PlaceholderToken {
  /** The full raw text including delimiters (e.g., "{{ input.x }}") */
  raw: string;
  /** The trimmed path body (may be empty for malformed tokens) */
  path: string;
  /** Inclusive start offset in the source text */
  startOffset: number;
  /** Exclusive end offset in the source text */
  endOffset: number;
  /** Whether the token has a closing }} */
  closed: boolean;
}

/** A single validation problem */
export interface PlaceholderValidationIssue {
  /** The token that caused the issue */
  token: PlaceholderToken;
  /** Exact string reason */
  reason: 'malformed_token' | 'invalid_path_format' | 'unknown_placeholder';
}

/** Full validation output */
export interface PlaceholderValidationResult {
  validTokens: PlaceholderToken[];
  invalidTokens: PlaceholderToken[];
  issues: PlaceholderValidationIssue[];
}

/** Output from resolveTemplatePlaceholders */
export interface PlaceholderResolutionResult {
  /** The resolved text with placeholders replaced */
  text: string;
  /** Validation issues found during resolution (when candidate paths provided) */
  issues: PlaceholderValidationIssue[];
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
