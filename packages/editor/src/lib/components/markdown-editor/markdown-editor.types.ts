import type {
  JsonObject,
  PlaceholderCompletionConfiguration,
  PlaceholderDecorationConfiguration,
  PlaceholderDefinitions,
  PlaceholderDiagnostic,
  PlaceholderValueMode,
} from '@lostgradient/markdown';
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Ctx } from '@milkdown/kit/ctx';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ActiveBlockType, ActiveMarks, EditorSelection } from '../../editor/index.ts';

/**
 * Editor display mode: the rich WYSIWYG editor, the raw Markdown source, or a
 * read-only rendered preview.
 */
export type EditorMode = 'wysiwyg' | 'source' | 'preview';

/**
 * Context passed to toolbar snippets for custom rendering.
 *
 * This carries everything `EditorToolbar` needs, so a caller can render a
 * complete toolbar — including one hosted outside this component, via
 * `onToolbarContextChange`. The handler fields matter: without them the
 * documented `toolbar` snippet ("replaces default toolbar") could not
 * reproduce undo, redo, or the link popover.
 */
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
  /** Whether the editor is readonly: the caller's `readonly` flag, in every mode */
  readonly: boolean;
  /** The current display mode */
  mode: EditorMode;
  /**
   * Whether formatting can apply right now: the rich editor is showing and
   * ready, and the editor is not readonly. False in source and preview mode,
   * where the formatting fields are inactive: no editor context, no undo or
   * redo, no active marks, a paragraph block, a closed link popover and
   * handlers that do nothing.
   */
  canEdit: boolean;
  /**
   * Switch to another display mode. Invalid modes are ignored; a real change
   * updates `mode` and calls `onModeChange` once.
   */
  onModeChange: (nextMode: EditorMode) => void;
  /** Apply an undo step */
  onUndo: () => void;
  /** Apply a redo step */
  onRedo: () => void;
  /** Open the link popover, anchored to the triggering button */
  onLinkClick: (triggerElement: HTMLElement) => void;
  /** Whether the link popover is currently open */
  linkPopoverOpen: boolean;
}

/**
 * Placeholder configuration: the high-level `placeholderDefinitions` or the
 * low-level `placeholderCompletion`/`placeholderDecoration` pair, never both.
 */
export type MarkdownEditorPlaceholderProps =
  | {
      /**
       * Allowed placeholders, as a JSON Schema or explicit candidates. Drives
       * completion, invalid-token decoration and diagnostics from one catalog.
       * Replacing the object updates the live editor without recreating it.
       */
      placeholderDefinitions?: PlaceholderDefinitions | undefined;
      placeholderCompletion?: undefined;
      placeholderDecoration?: undefined;
    }
  | {
      placeholderDefinitions?: undefined;
      /**
       * Placeholder completion configuration (DEP-583).
       * When provided, enables inline suggestion menu for {{…}} tokens in WYSIWYG mode.
       */
      placeholderCompletion?: PlaceholderCompletionConfiguration | undefined;
      /**
       * Placeholder decoration configuration (DEP-583).
       * When provided, decorates invalid {{…}} tokens with CSS class and data attributes.
       */
      placeholderDecoration?: PlaceholderDecorationConfiguration | undefined;
    };

export type MarkdownEditorProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'id' | 'class' | 'onchange' | 'onselectionchange'
> & {
  /** Unique identifier for accessibility (required) */
  id: string;
  /** Accessible label for the editor (required for screen readers) */
  label?: string;
  /** Current markdown content (two-way bindable) */
  value?: string;
  /**
   * Editor display mode (two-way bindable). An invalid value keeps the last
   * valid mode (`'wysiwyg'` on mount) and reports `invalid_option` at `mode`.
   */
  mode?: EditorMode;
  /**
   * Show the built-in mode control for switching between the rich editor, raw
   * Markdown and preview. It renders whenever this is true, including with a
   * custom `toolbar`, `toolbarEnabled={false}` or `readonly`.
   */
  modeToggleVisible?: boolean;
  /** Accessible label for the mode toggle (visually hidden) */
  modeLabel?: string;
  /** Read-only mode */
  readonly?: boolean;
  /**
   * Hint text shown while the editor is empty. Unrelated to `{{path}}` template
   * placeholders, which `placeholderDefinitions` configures.
   */
  placeholder?: string;
  /** Show formatting toolbar (DEP-37) */
  toolbarEnabled?: boolean;
  /** Additional CSS classes */
  class?: string;
  /** Called when content changes */
  onValueChange?: (value: string) => void;
  /** Called when the editor is ready (Milkdown initialized) */
  onReady?: () => void;
  /** Called when editor mode changes */
  onModeChange?: (mode: EditorMode) => void;
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
   * Placeholder values for filled preview. Never used for completion, and never
   * included in a diagnostic. Supplying values without `placeholderDefinitions`,
   * or values that are not a plain JSON object, reports a configuration diagnostic.
   */
  placeholderValues?: JsonObject | undefined;

  /**
   * How preview inserts string placeholder values: `'text'` (the default)
   * renders them as literal text, `'markdown'` lets them contribute Markdown
   * formatting. Other values render as literal JSON either way. An invalid
   * string reports `invalid_option` at `placeholderValueMode` and disables fill.
   */
  placeholderValueMode?: PlaceholderValueMode | undefined;

  /**
   * Called with the ordered placeholder diagnostics whenever that list changes.
   * Token ranges index the Markdown `value`. Called with `[]` only to clear
   * earlier diagnostics.
   */
  onPlaceholderDiagnosticsChange?: (diagnostics: readonly PlaceholderDiagnostic[]) => void;

  // =========================================================================
  // Snippet-based Extensibility
  // =========================================================================

  /**
   * Custom toolbar content. When provided, replaces default toolbar.
   * Receives ToolbarContext for building custom toolbar UI.
   */
  toolbar?: Snippet<[ToolbarContext]>;

  /**
   * Notified whenever the toolbar context changes.
   *
   * Use this to host the formatting controls somewhere this component does not
   * render — for example folding them into a surrounding application toolbar so
   * the editor does not stack a second bar of its own. Pair it with
   * `toolbarEnabled={false}`.
   */
  onToolbarContextChange?: (context: ToolbarContext) => void;

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
} & MarkdownEditorPlaceholderProps;
