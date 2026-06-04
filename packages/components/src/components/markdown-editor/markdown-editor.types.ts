import type {
  ActiveBlockType,
  ActiveMarks,
  EditorHandle as EditorHandleType,
  EditorSelection,
  PlaceholderCompletionConfiguration,
  PlaceholderDecorationConfiguration,
} from '@lostgradient/cinder/editor/component-runtime';
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Ctx } from '@milkdown/kit/ctx';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Editor display mode */
export type EditorMode = 'wysiwyg' | 'source';

/** Context passed to toolbar snippets for custom rendering */
export interface ToolbarContext {
  /** The Milkdown editor context (null if not ready) */
  editorContext: Ctx | null;
  /** Currently active marks at cursor position */
  activeMarks: ActiveMarks;
  /** Currently active block type at cursor position */
  activeBlockType: ActiveBlockType;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Whether the editor is readonly */
  readonly: boolean;
}

export type MarkdownEditorProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'id' | 'class' | 'onchange'
> & {
  /** Unique identifier for accessibility (required) */
  id: string;
  /** Accessible label for the editor (required for screen readers) */
  label?: string;
  /** Current markdown content (two-way bindable) */
  value?: string;
  /** Editor display mode (two-way bindable) */
  mode?: EditorMode;
  /** Show an inline toggle for switching between WYSIWYG and raw Markdown */
  showModeToggle?: boolean;
  /** Accessible label for the mode toggle (visually hidden) */
  modeLabel?: string;
  /** Read-only mode */
  readonly?: boolean;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Show formatting toolbar (DEP-37) */
  showToolbar?: boolean;
  /** Additional CSS classes */
  class?: string;
  /** Called when content changes */
  onchange?: (value: string) => void;
  /** Called when the editor is ready (Milkdown initialized) */
  onReady?: () => void;
  /** Called when editor mode changes */
  onmodechange?: (mode: EditorMode) => void;
  /** Called when selection changes (stub for DEP-39) */
  onSelectionChange?: (selection: EditorSelection | null) => void;
  /** Called when comment shortcut (Ctrl-Alt-c) is pressed (DEP-47) */
  onCommentShortcut?: () => void;
  /**
   * Additional Milkdown plugins to load.
   * Used for comment anchoring (DEP-39), decorations, and other extensions.
   */
  plugins?: MilkdownPlugin[];

  /**
   * Placeholder completion configuration (DEP-583).
   * When provided, enables inline suggestion menu for {{…}} tokens in WYSIWYG mode.
   */
  placeholderCompletion?: PlaceholderCompletionConfiguration;

  /**
   * Placeholder decoration configuration (DEP-583).
   * When provided, decorates invalid {{…}} tokens with CSS class and data attributes.
   */
  placeholderDecoration?: PlaceholderDecorationConfiguration;

  // =========================================================================
  // Snippet-based Extensibility
  // =========================================================================

  /**
   * Custom toolbar content. When provided, replaces default toolbar.
   * Receives ToolbarContext for building custom toolbar UI.
   */
  toolbar?: Snippet<[ToolbarContext]>;

  /**
   * Additional toolbar actions (appended to default toolbar).
   * Use this for adding buttons without replacing the entire toolbar.
   */
  toolbarActions?: Snippet<[ToolbarContext]>;

  /**
   * Leading toolbar content (prepended before default toolbar items).
   * Useful for adding undo/redo or other leading actions.
   */
  toolbarLeading?: Snippet<[ToolbarContext]>;

  /**
   * Snapshot mode for visual regression testing.
   *
   * When `true`:
   * - Applies `caret-color: transparent` and `user-select: none` to the editor
   *   root via a `data-snapshot-mode` attribute, producing a stable visual
   *   state (no blinking cursor, no selection highlights).
   * - Blurs any focused element inside the component on mount so the initial
   *   screenshot does not capture a focused ring or active caret.
   *
   * This is a purely visual / CSS concern. It does NOT affect editability,
   * ProseMirror state, or any prop controlled by `readonly` / `mode`.
   */
  snapshotMode?: boolean;
};

/** Re-export EditorHandle type for convenience */
export type EditorHandle = EditorHandleType;
