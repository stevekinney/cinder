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
    { commonmark, listItemKeymap },
    { gfm, tableKeymap },
    { history },
    { listener, listenerCtx },
    { getMarkdown, replaceAll },
    { preloadCommandRuntime },
    { preloadLazyPluginRuntime },
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
    import('./milkdown-plugin-runtime.js'),
    import('./placeholder.js'),
    import('./keymap-plugin.js'),
    import('./clipboard.js'),
    import('./link-input-rule.js'),
    import('./template-completion-plugin.js'),
    import('./template-invalid-decoration-plugin.js'),
  ]);
  await preloadCommandRuntime();
  // cinder#1306: primes the cache createLazyProsePlugin/createLazyInputRule
  // need to register a timer synchronously (see milkdown-plugin-runtime.ts).
  // Must resolve before any `.use(...)` call below reaches one of those
  // plugins' outer function, so it runs alongside preloadCommandRuntime(),
  // before the builder chain starts.
  await preloadLazyPluginRuntime();

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
  const resolvedAriaLabel =
    typeof ariaLabel === 'string' && ariaLabel.trim().length > 0 ? ariaLabel.trim() : undefined;

  // Track if we're updating from external source to prevent loops
  let isExternalUpdate = false;
  // Track if editor is destroyed to prevent accessing context after cleanup
  let isDestroyed = false;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingInternalMarkdown: string | null = null;
  // Build the editor
  let builder = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, container);
      ctx.set(defaultValueCtx, initialContent);
      if (resolvedAriaLabel) {
        ctx.update(editorViewOptionsCtx, (previous) => {
          const previousAttributes = previous.attributes;

          return {
            ...previous,
            attributes:
              typeof previousAttributes === 'function'
                ? (state) => ({ ...previousAttributes(state), 'aria-label': resolvedAriaLabel })
                : { ...previousAttributes, 'aria-label': resolvedAriaLabel },
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
          pendingInternalMarkdown = null;
          onchange?.(markdown);
        }, changeDebounceMs);
      });

      // Selection change tracking (for DEP-39 comment anchoring and toolbar state)
      // We need TWO listeners:
      // 1. selectionUpdated - fires on selection-only changes (user clicks without editing)
      // 2. updated - fires on document changes (which also change the selection position)
      // Together, these ensure the toolbar always reflects the current cursor position.
      if (onselectionchange) {
        const notifySelectionChange = (
          listenerContext: Ctx,
          liveSelection?: { from: number; to: number },
        ) => {
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

          const { from, to } = liveSelection ?? view.state.selection;
          const selection: EditorSelection = {
            from,
            to,
            isCollapsed: from === to,
          };

          onselectionchange(selection);
        };

        // Listen for selection-only changes (clicking without editing)
        listenerManager.selectionUpdated((listenerContext, selection) =>
          notifySelectionChange(listenerContext, selection),
        );

        // Listen for document changes (which also affect selection position)
        listenerManager.updated((listenerContext) => notifySelectionChange(listenerContext));
      }
    })
    .config((ctx) => {
      // cinder#1302: the commonmark preset's own listItemKeymap binds plain
      // Tab/Shift-Tab to sink/lift-list-item (see @milkdown/preset-commonmark's
      // listItemKeymap). That binding and createEditorKeymap's Tab-escape latch
      // (keymap-plugin.ts) both get merged into ONE ProseMirror keymap plugin —
      // Milkdown's KeymapManager chains every handler registered for a key into
      // a single command, in priority order (ties broken by registration
      // order) — and the preset's plugin registers first, so its handler always
      // ran before ours got a chance. A successful sink/lift returns true,
      // which stops the chain and preventDefaults the key, so the latch's
      // Escape-then-Tab release (armed correctly) was never actually reachable:
      // the preset's Tab handler re-indented before the chain ever reached the
      // latch-aware binding.
      //
      // Fix: strip Tab/Shift-Tab from the preset's own keymap here, before its
      // $shortcut plugin builds (it waits on KeymapReady, which is gated on
      // SchemaReady — far later than this synchronous config callback runs —
      // so there is no race). Mod-]/Mod-[ stay bound, so indent/outdent remains
      // reachable by keyboard; Tab/Shift-Tab become exclusively
      // createEditorKeymap's to handle, which is the only place the WCAG 2.1.2
      // escape latch lives.
      ctx.update(listItemKeymap.key, (current) => ({
        ...current,
        SinkListItem: { ...current.SinkListItem, shortcuts: 'Mod-]' },
        LiftListItem: { ...current.LiftListItem, shortcuts: 'Mod-[' },
      }));

      // GFM's tableKeymap binds the identical trap one node type over: plain
      // Tab/Shift-Tab move between table cells, with the SAME
      // registers-before-the-latch ordering (and higher priority — 100 vs.
      // the default 50 — so it would win even more decisively). Found while
      // implementing the list fix above; same mechanism, same fix. Mod-]/
      // Mod-[ already exist as tableKeymap's OWN alternate bindings for
      // NextCell/PrevCell, so keeping them here costs nothing extra and
      // matches the list keymap's shape.
      ctx.update(tableKeymap.key, (current) => ({
        ...current,
        NextCell: { ...current.NextCell, shortcuts: 'Mod-]' },
        PrevCell: { ...current.PrevCell, shortcuts: 'Mod-[' },
      }));
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

  // ProseMirror's transaction dispatch is the first synchronous point at
  // which the live document is authoritative. Keep the component's value
  // owner current there, while leaving the public onchange callback debounced.
  const dispatchTransaction = view.props.dispatchTransaction;
  view.setProps({
    dispatchTransaction: (transaction) => {
      if (dispatchTransaction) {
        dispatchTransaction(transaction);
      } else {
        view.updateState(view.state.apply(transaction));
      }
      if (
        transaction.docChanged &&
        transaction.getMeta('addToHistory') !== false &&
        !isDestroyed &&
        !isExternalUpdate
      ) {
        pendingInternalMarkdown = editor.action(getMarkdown());
      }
    },
  });

  // Apply readonly state
  if (readonly && view) {
    view.setProps({ editable: () => false });
  }
  applyReadonlyAria(view, readonly);

  // Apply aria-label to the ProseMirror DOM element (the element with role="textbox")
  if (resolvedAriaLabel && view?.dom) {
    view.dom.setAttribute('aria-label', resolvedAriaLabel);
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

    getPendingInternalMarkdown() {
      return pendingInternalMarkdown;
    },

    setMarkdown(content: string) {
      // Clear any pending debounce to prevent stale callbacks
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }

      pendingInternalMarkdown = null;
      isExternalUpdate = true;
      try {
        editor.action(replaceAll(content));
      } finally {
        isExternalUpdate = false;
      }
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
 * Mirror the readonly flag onto the ProseMirror DOM node as `aria-readonly`.
 *
 * `editable: () => false` gives that node `contenteditable="false"`, which stops
 * edits but does NOT convey read-only-ness: Chromium still computes the textbox
 * as `readonly=false, settable=true` — indistinguishable from an editable
 * editor, so a screen reader announces an editable field that silently ignores
 * typing.
 *
 * It has to go on `view.dom` specifically. Measured with CDP
 * `Accessibility.getFullAXTree`: `aria-readonly` on the wrapping
 * `role="application"` host changes nothing, because the textbox role lives on
 * the ProseMirror node, and ARIA states do not inherit down to it. That is the
 * same reason `aria-label` is applied to `view.dom` rather than to the host.
 */
function applyReadonlyAria(view: EditorState['view'] | null | undefined, readonly: boolean): void {
  if (!view?.dom) return;
  if (readonly) {
    view.dom.setAttribute('aria-readonly', 'true');
  } else {
    view.dom.removeAttribute('aria-readonly');
  }
}

/**
 * Update the readonly state of an editor.
 */
export function setEditorReadonly(state: EditorState, readonly: boolean): void {
  state.view?.setProps({ editable: () => !readonly });
  applyReadonlyAria(state.view, readonly);
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
