/**
 * Svelte 5 attachment factory for Milkdown editor.
 *
 * This module provides the {@attach} integration pattern for mounting
 * Milkdown within Svelte components. The attachment handles:
 * - Editor initialization
 * - Lifecycle management (mount/destroy)
 * - Reactive readonly updates
 * - Live placeholder configuration updates without recreating the editor
 * - Two-way binding with effect loop prevention
 */

import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { watchReactiveValue } from './attach-reactive-watch.svelte.ts';
import type { EditorAttachmentOptions, EditorConfig, EditorState } from './types.js';
import { DEFAULT_DEBOUNCE_MS } from './types.js';

type EditorRuntime = typeof import('./editor.js');

/**
 * Create an attachment function for the {@attach} directive.
 *
 * @example
 * ```svelte
 * <script>
 *   const editorAttachment = createEditorAttachment({
 *     getInitialValue: () => markdown,
 *     getReadonly: () => readonly,
 *     onready: (state) => { editorState = state; },
 *     onchange: (md) => { markdown = md; },
 *   });
 * </script>
 *
 * <div {@attach editorAttachment}></div>
 * ```
 */
export function createEditorAttachment(options: EditorAttachmentOptions): Attachment<HTMLElement> {
  const {
    getInitialValue,
    getReadonly,
    getAriaLabel,
    onready,
    onchange,
    onselectionchange,
    onlinkshortcut,
    onCommentShortcut,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    getPlugins,
    getPlaceholderConfiguration,
    placeholderListboxId,
    onPlaceholderStatusChange,
  } = options;

  return (element: HTMLElement) => {
    let editorState: EditorState | null = null;
    let editorRuntime: EditorRuntime | null = null;
    let destroyed = false;

    // Untrack getter calls to prevent the attachment effect from re-running
    // when reactive props (value, readonly, plugins) change. The component
    // handles reactive updates separately via its own $effect blocks.
    const initialContent = untrack(() => getInitialValue());
    const readonly = untrack(() => getReadonly());
    const ariaLabel = untrack(() => getAriaLabel());
    const plugins = untrack(() => getPlugins?.() ?? []);
    const placeholders = untrack(() => getPlaceholderConfiguration?.());
    let latestPlaceholders = placeholders;

    const editorConfiguration: EditorConfig = {
      initialContent,
      readonly,
      ariaLabel,
      changeDebounceMs: debounceMs,
      plugins,
      ...(onchange && { onchange }),
      ...(onselectionchange && { onselectionchange }),
      ...(onlinkshortcut && { onlinkshortcut }),
      ...(onCommentShortcut && { onCommentShortcut }),
      ...(placeholders && { placeholders }),
      ...(placeholderListboxId && { placeholderListboxId }),
      ...(onPlaceholderStatusChange && { onPlaceholderStatusChange }),
    };

    // Placeholder configuration is live: every new configuration object is
    // installed through a metadata-only transaction, never by recreating the
    // editor. Changes made while the editor initializes are applied on ready.
    const stopWatchingPlaceholders = getPlaceholderConfiguration
      ? watchReactiveValue(getPlaceholderConfiguration, (next) => {
          latestPlaceholders = next;
          editorState?.setPlaceholderConfiguration(next);
        })
      : () => {};

    // Initialize editor asynchronously. The editor runtime, and Milkdown and
    // ProseMirror with it, loads here on first mount rather than when this
    // module is imported, so a source- or preview-only MarkdownEditor never
    // evaluates them (COR-1322).
    void (async () => {
      try {
        const runtime = await import('./editor.js');
        // Detached while the runtime loaded: there is no editor to tear down,
        // so do not build one for an element that has already left.
        if (destroyed) return;
        editorRuntime = runtime;
        const { createEditor, destroyEditor } = runtime;
        const state = await createEditor(element, editorConfiguration);

        // Guard against race condition if destroyed before init completes
        if (destroyed) {
          await destroyEditor(state);
          return;
        }

        editorState = state;
        state.setPlaceholderConfiguration(latestPlaceholders);
        onready?.(state);
      } catch (error) {
        if (typeof globalThis.reportError === 'function') globalThis.reportError(error);
        else throw error;
      }
    })();

    return () => {
      destroyed = true;
      stopWatchingPlaceholders();
      // An editor state exists only after the runtime loaded, so the runtime
      // that created it is the one that destroys it.
      if (editorState && editorRuntime) {
        void editorRuntime.destroyEditor(editorState).catch((error) => {
          if (typeof globalThis.reportError === 'function') globalThis.reportError(error);
          else throw error;
        });
        editorState = null;
      }
    };
  };
}
