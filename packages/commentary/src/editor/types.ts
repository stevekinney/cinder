/**
 * Types for the Milkdown editor integration.
 *
 * This module defines the public API surface for the editor,
 * including configuration, handle interface, and selection state.
 *
 * Placeholder types (DEP-582/DEP-583) live in `@cinder/markdown`'s
 * `templates/types.ts` — split from this module when `@cinder/editor` was
 * dissolved, since they are consumed by the headless template pipeline too.
 */

import type { Root } from '@cinder/markdown/pipeline';
import type {
  PlaceholderCompletionConfiguration,
  PlaceholderDecorationConfiguration,
} from '@cinder/markdown/templates/types';
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Editor } from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';

/**
 * Source coordinate for a position in markdown text.
 */
export type SourcePosition = {
  /** 1-indexed line number */
  line: number;
  /** 1-indexed column number */
  column: number;
  /** 0-indexed UTF-16 character offset */
  offset: number;
};

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
  /** Debounce interval for onchange callback (ms) */
  changeDebounceMs?: number;
  /** Callback when content changes (debounced) */
  onchange?: (markdown: string) => void;
  /** Callback when selection changes */
  onselectionchange?: (selection: EditorSelection | null) => void;
  /** Callback when link keyboard shortcut (Mod-k) is pressed */
  onlinkshortcut?: () => void;
  /** Callback when comment shortcut (Ctrl-Alt-c) is pressed (DEP-47) */
  oncommentshortcut?: () => void;
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
  onready?: (state: EditorState) => void;
  /** Called when document changes (debounced) */
  onchange?: (markdown: string) => void;
  /** Called when selection changes */
  onselectionchange?: (selection: EditorSelection | null) => void;
  /** Called when link keyboard shortcut (Mod-k) is pressed */
  onlinkshortcut?: () => void;
  /** Called when comment shortcut (Ctrl-Alt-c) is pressed (DEP-47) */
  oncommentshortcut?: () => void;
  /** Debounce delay for onchange in ms */
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
