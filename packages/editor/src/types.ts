/**
 * Types for the Milkdown editor integration.
 *
 * This module defines the public API surface for the editor,
 * including configuration, handle interface, and selection state.
 */

import type { SourcePosition } from '@cinder/markdown/diff/types';
import type { Root } from '@cinder/markdown/pipeline';
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Editor } from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';

/**
 * Editor configuration options.
 */
export interface EditorConfig {
  /** Initial markdown content */
  initialContent?: string;
  /** Read-only mode (no editing allowed) */
  readonly?: boolean;
  /** Accessible label for the editor (applied to ProseMirror element) */
  ariaLabel?: string;
  /** Debounce interval for onChange callback (ms) */
  changeDebounceMs?: number;
  /** Callback when content changes (debounced) */
  onChange?: (markdown: string) => void;
  /** Callback when selection changes (stub for DEP-39) */
  onSelectionChange?: (selection: EditorSelection | null) => void;
  /** Callback when link keyboard shortcut (Mod-k) is pressed */
  onLinkShortcut?: () => void;
  /** Callback when comment shortcut (Ctrl-Alt-c) is pressed (DEP-47) */
  onCommentShortcut?: () => void;
  /**
   * Additional Milkdown plugins to load.
   *
   * Use this for comment anchoring, decorations, and other extensions.
   * Plugins are applied after the core plugins (commonmark, gfm, history, listener).
   *
   * @example
   * ```typescript
   * plugins: [createAnchorPlugin(threads)]
   * ```
   */
  plugins?: MilkdownPlugin[];

  /**
   * Placeholder completion configuration (DEP-583).
   * When provided, enables inline suggestion menu for `{{…}}` tokens in WYSIWYG mode.
   */
  placeholderCompletion?: PlaceholderCompletionConfiguration;

  /**
   * Placeholder decoration configuration (DEP-583).
   * When provided, decorates invalid `{{…}}` tokens with CSS class and data attributes.
   */
  placeholderDecoration?: PlaceholderDecorationConfiguration;
}

/**
 * Selection state exposed to consumers.
 * Used for comment anchoring (DEP-39) and suggested edits (DEP-43).
 */
export interface EditorSelection {
  /** ProseMirror start position */
  from: number;
  /** ProseMirror end position */
  to: number;
  /** Is the selection collapsed (cursor only)? */
  isCollapsed: boolean;
  /** Mapped to mdast position via bridge (when available) */
  sourcePosition?: SourcePosition | null;
}

/**
 * Imperative handle for external control of the editor.
 * Exposed via bind:this on the component.
 */
export interface EditorHandle {
  /** Focus the editor */
  focus(): void;

  /** Get current markdown content */
  getMarkdown(): string;

  /** Set markdown content (replaces entire document) */
  setMarkdown(content: string): void;

  /** Get current mdast AST (via DEP-35 pipeline) */
  getAst(): Root;

  /** Get current selection state */
  getSelection(): EditorSelection | null;

  /**
   * Direct access to ProseMirror EditorView.
   * Advanced use only - for DEP-39/43 integration.
   */
  readonly view: EditorView | null;

  /**
   * Direct access to Milkdown Editor instance.
   * Advanced use only.
   */
  readonly editor: Editor | null;
}

/**
 * Internal state for the editor attachment.
 */
export interface EditorState {
  editor: Editor;
  view: EditorView;
  focus(): void;
  getMarkdown(): string;
  setMarkdown(content: string): void;
  /** Clear any pending debounce timers (called on destroy) */
  clearPendingTimers(): void;
  /** Mark the editor as destroyed to prevent callbacks from firing after cleanup */
  markDestroyed(): void;
}

/**
 * Options for the editor attachment factory.
 */
export interface EditorAttachmentOptions {
  /** Get initial markdown value */
  getInitialValue: () => string;
  /** Get current readonly state */
  getReadonly: () => boolean;
  /** Get accessible label for the editor */
  getAriaLabel: () => string;
  /** Called when editor is ready */
  onReady?: (state: EditorState) => void;
  /** Called when document changes (debounced) */
  onChange?: (markdown: string) => void;
  /** Called when selection changes */
  onSelectionChange?: (selection: EditorSelection | null) => void;
  /** Called when link keyboard shortcut (Mod-k) is pressed */
  onLinkShortcut?: () => void;
  /** Called when comment shortcut (Ctrl-Alt-c) is pressed (DEP-47) */
  onCommentShortcut?: () => void;
  /** Debounce delay for onChange in ms */
  debounceMs?: number;
  /**
   * Additional Milkdown plugins to load.
   * Used for comment anchoring (DEP-39), decorations, and other extensions.
   */
  getPlugins?: () => MilkdownPlugin[];

  /**
   * Get placeholder completion configuration (DEP-583).
   * Returns undefined to disable, or a configuration object to enable.
   */
  getPlaceholderCompletion?: () => PlaceholderCompletionConfiguration | undefined;

  /**
   * Get placeholder decoration configuration (DEP-583).
   * Returns undefined to disable, or a configuration object to enable.
   */
  getPlaceholderDecoration?: () => PlaceholderDecorationConfiguration | undefined;
}

/** Default debounce for content changes (matches DiffViewer) */
export const DEFAULT_DEBOUNCE_MS = 300;

// Template placeholder types (DEP-582)

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
