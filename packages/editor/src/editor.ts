/**
 * Core Milkdown editor initialization.
 *
 * This module configures Milkdown with CommonMark + GFM support,
 * integrating with the DEP-35 pipeline for consistent serialization.
 */

import type { Ctx } from '@milkdown/kit/ctx';

import type { EditorConfig, EditorSelection, EditorState } from './types.js';
import { DEFAULT_DEBOUNCE_MS } from './types.js';

function shouldLogDevelopmentWarnings(): boolean {
  return typeof process === 'undefined' || process.env.NODE_ENV !== 'production';
}

/**
 * Create and configure a Milkdown editor instance.
 *
 * @param container - DOM element to mount the editor in
 * @param config - Editor configuration
 * @returns Promise resolving to EditorState for imperative control
 */
export async function createEditor(
  container: HTMLElement,
  config: EditorConfig = {},
): Promise<EditorState> {
  if (typeof document === 'undefined') {
    throw new Error('createEditor() requires a browser document.');
  }

  const [
    { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx },
    { commonmark },
    { gfm },
    { history },
    { listener, listenerCtx },
    { getMarkdown, replaceAll },
    { preloadCommandRuntime },
    { placeholderPlugin },
    { createEditorKeymap },
    { clipboardPlugin },
    { linkInputRulePlugin },
    { createTemplateCompletionPlugin },
    { createTemplateInvalidDecorationPlugin },
  ] = await Promise.all([
    import('@milkdown/kit/core'),
    import('@milkdown/kit/preset/commonmark'),
    import('@milkdown/kit/preset/gfm'),
    import('@milkdown/kit/plugin/history'),
    import('@milkdown/kit/plugin/listener'),
    import('@milkdown/kit/utils'),
    import('./commands.js'),
    import('./placeholder.js'),
    import('./keymap-plugin.js'),
    import('./clipboard.js'),
    import('./link-input-rule.js'),
    import('./template-completion-plugin.js'),
    import('./template-invalid-decoration-plugin.js'),
  ]);
  await preloadCommandRuntime();

  const {
    initialContent = '',
    readonly = false,
    ariaLabel,
    changeDebounceMs = DEFAULT_DEBOUNCE_MS,
    onchange,
    onselectionchange,
    onlinkshortcut,
    oncommentshortcut,
    plugins = [],
    placeholderCompletion,
    placeholderDecoration,
  } = config;

  // Track if we're updating from external source to prevent loops
  let isExternalUpdate = false;
  // Track if editor is destroyed to prevent accessing context after cleanup
  let isDestroyed = false;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  // Build the editor
  let builder = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, container);
      ctx.set(defaultValueCtx, initialContent);
      if (ariaLabel) {
        ctx.update(editorViewOptionsCtx, (previous) => {
          const previousAttributes = previous.attributes;

          return {
            ...previous,
            attributes:
              typeof previousAttributes === 'function'
                ? (state) => ({ ...previousAttributes(state), 'aria-label': ariaLabel })
                : { ...previousAttributes, 'aria-label': ariaLabel },
          };
        });
      }
    })
    .config((ctx) => {
      // Set up change listener
      const listenerManager = ctx.get(listenerCtx);

      listenerManager.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        // Skip if editor is destroyed (debounced callback fired after cleanup)
        if (isDestroyed) return;
        // Skip if this is an external update (from setMarkdown)
        if (isExternalUpdate) return;
        // Skip if content unchanged
        if (markdown === prevMarkdown) return;

        // Debounce onChange calls
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          if (isDestroyed) return; // Guard after debounce
          onchange?.(markdown);
        }, changeDebounceMs);
      });

      // Selection change tracking (for DEP-39 comment anchoring and toolbar state)
      // We need TWO listeners:
      // 1. selectionUpdated - fires on selection-only changes (user clicks without editing)
      // 2. updated - fires on document changes (which also change the selection position)
      // Together, these ensure the toolbar always reflects the current cursor position.
      if (onselectionchange) {
        const notifySelectionChange = (listenerContext: Ctx) => {
          // Skip if editor is destroyed
          if (isDestroyed) return;

          // Wrap context access in try-catch - Milkdown may have already cleared
          // its context registry during unmount, causing ctx.get() to throw
          let view;
          try {
            view = listenerContext.get(editorViewCtx);
          } catch {
            // Context already destroyed during cleanup, silently ignore
            return;
          }
          // Guard against view not being ready or state not yet attached
          if (!view?.state) return;

          const { from, to } = view.state.selection;
          const selection: EditorSelection = {
            from,
            to,
            isCollapsed: from === to,
          };

          onselectionchange(selection);
        };

        // Listen for selection-only changes (clicking without editing)
        listenerManager.selectionUpdated(notifySelectionChange);

        // Listen for document changes (which also affect selection position)
        listenerManager.updated(notifySelectionChange);
      }
    })
    .use(commonmark)
    .use(gfm)
    .use(linkInputRulePlugin)
    .use(clipboardPlugin)
    .use(history)
    .use(
      createEditorKeymap({
        ...(onlinkshortcut ? { onlinkshortcut } : {}),
        ...(oncommentshortcut ? { oncommentshortcut } : {}),
      }),
    ) // DEP-37/47: Keyboard shortcuts
    .use(listener)
    .use(placeholderPlugin);

  // DEP-583: Conditionally register placeholder completion plugin
  if (placeholderCompletion) {
    const completionConfig = placeholderCompletion;
    builder = builder.use(createTemplateCompletionPlugin(() => completionConfig));
  }

  // DEP-583: Conditionally register placeholder invalid decoration plugin
  if (placeholderDecoration) {
    const decorationConfig = placeholderDecoration;
    builder = builder.use(
      createTemplateInvalidDecorationPlugin(
        () => decorationConfig.candidates,
        decorationConfig.invalidClassName ? () => decorationConfig.invalidClassName! : undefined,
      ),
    );
  }

  // Apply additional plugins (for DEP-39 anchoring, decorations, etc.)
  const editor = await builder.use(plugins).create();

  // Get the view for direct access
  const view = editor.ctx.get(editorViewCtx);

  // Apply readonly state
  if (readonly && view) {
    view.setProps({ editable: () => false });
  }

  // Apply aria-label to the ProseMirror DOM element (the element with role="textbox")
  if (ariaLabel && view?.dom) {
    view.dom.setAttribute('aria-label', ariaLabel);
  }

  // Build the state object
  const state: EditorState = {
    editor,
    view,

    focus() {
      view?.focus();
    },

    getMarkdown() {
      return editor.action(getMarkdown());
    },

    setMarkdown(content: string) {
      // Clear any pending debounce to prevent stale callbacks
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }

      isExternalUpdate = true;
      editor.action(replaceAll(content));
      // Reset flag after microtask
      queueMicrotask(() => {
        isExternalUpdate = false;
      });
    },

    clearPendingTimers() {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }
    },

    markDestroyed() {
      isDestroyed = true;
    },
  };

  return state;
}

/**
 * Update the readonly state of an editor.
 */
export function setEditorReadonly(state: EditorState, readonly: boolean): void {
  state.view?.setProps({ editable: () => !readonly });
}

// Track stderr suppression nesting to prevent race conditions (DEP-139).
// When multiple destroyEditor calls execute concurrently, we need reference counting
// to ensure we only restore stderr when the outermost call completes.
let stderrSuppressionDepth = 0;
let originalStderrWrite: NodeJS.WriteStream['write'] | null = null;

function writeWithSuppressedMilkdownErrors(
  this: NodeJS.WriteStream,
  buffer: string | Uint8Array,
  callback?: (error?: Error | null) => void,
): boolean;
function writeWithSuppressedMilkdownErrors(
  this: NodeJS.WriteStream,
  str: string | Uint8Array,
  encoding?: BufferEncoding,
  callback?: (error?: Error | null) => void,
): boolean;
function writeWithSuppressedMilkdownErrors(
  this: NodeJS.WriteStream,
  chunk: string | Uint8Array,
  encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
  callback?: (error?: Error | null) => void,
): boolean {
  const message = typeof chunk === 'string' ? chunk : chunk.toString();
  if (message.includes('MilkdownError')) {
    return true;
  }

  if (!originalStderrWrite) return true;

  if (typeof encodingOrCallback === 'function') {
    return originalStderrWrite(chunk, encodingOrCallback);
  }

  return originalStderrWrite(chunk, encodingOrCallback, callback);
}

/**
 * Destroy an editor instance and clean up resources.
 */
export function destroyEditor(state: EditorState): void {
  // Mark destroyed first to prevent debounced callbacks from accessing context
  state.markDestroyed();
  state.clearPendingTimers();

  // Suppress MilkdownError stderr output during destruction (DEP-139).
  // Milkdown logs "Context editorView not found" errors to stderr during teardown
  // when it accesses its own context that's being destroyed. These are harmless.
  // Only applicable in Node/test environments; browser builds don't have process.stderr.
  const stderr = typeof process !== 'undefined' ? process.stderr : undefined;

  if (stderr) {
    // Increment depth and capture original on first entry
    if (stderrSuppressionDepth === 0) {
      originalStderrWrite = stderr.write.bind(stderr);
      stderr.write = writeWithSuppressedMilkdownErrors;
    }
    stderrSuppressionDepth++;
  }

  try {
    void state.editor.destroy();
  } catch (error) {
    // Milkdown can throw during teardown if its context registry has already been cleared
    // (e.g. rapid mount/unmount in tests). Destroy should never crash the app.
    // Suppress "Context editorView not found" errors during cleanup - they're harmless.
    const isMilkdownContextError =
      error instanceof Error &&
      error.message.includes('Context') &&
      error.message.includes('not found');

    if (!isMilkdownContextError && shouldLogDevelopmentWarnings()) {
      console.warn('[Editor] Failed to destroy Milkdown editor:', error);
    }
  } finally {
    // Decrement depth and restore stderr only when reaching zero
    if (stderr) {
      stderrSuppressionDepth--;
      if (stderrSuppressionDepth === 0 && originalStderrWrite) {
        stderr.write = originalStderrWrite;
        originalStderrWrite = null;
      }
    }
  }
}
