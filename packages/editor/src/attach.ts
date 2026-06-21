/**
 * Svelte 5 attachment factory for Milkdown editor.
 *
 * This module provides the {@attach} integration pattern for mounting
 * Milkdown within Svelte components. The attachment handles:
 * - Editor initialization
 * - Lifecycle management (mount/destroy)
 * - Reactive readonly updates
 * - Two-way binding with effect loop prevention
 */

import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { createEditor, destroyEditor } from './editor.js';
import type { EditorAttachmentOptions, EditorConfig, EditorState } from './types.js';
import { DEFAULT_DEBOUNCE_MS } from './types.js';

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
    onSelectionchange,
    onLinkShortcut,
    onCommentShortcut,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    getPlugins,
    getPlaceholderCompletion,
    getPlaceholderDecoration,
  } = options;

  return (element: HTMLElement) => {
    let editorState: EditorState | null = null;
    let destroyed = false;

    // Untrack getter calls to prevent the attachment effect from re-running
    // when reactive props (value, readonly, plugins) change. The component
    // handles reactive updates separately via its own $effect blocks.
    const initialContent = untrack(() => getInitialValue());
    const readonly = untrack(() => getReadonly());
    const ariaLabel = untrack(() => getAriaLabel());
    const plugins = untrack(() => getPlugins?.() ?? []);
    const placeholderCompletion = untrack(() => getPlaceholderCompletion?.());
    const placeholderDecoration = untrack(() => getPlaceholderDecoration?.());

    const editorConfiguration: EditorConfig = {
      initialContent,
      readonly,
      ariaLabel,
      changeDebounceMs: debounceMs,
      plugins,
      ...(onchange && { onchange }),
      ...(onselectionchange && { onselectionchange }),
      ...(onLinkShortcut && { onLinkShortcut }),
      ...(onCommentShortcut && { onCommentShortcut }),
      ...(placeholderCompletion && { placeholderCompletion }),
      ...(placeholderDecoration && { placeholderDecoration }),
    };

    // Initialize editor asynchronously
    void (async () => {
      try {
        const state = await createEditor(element, editorConfiguration);

        // Guard against race condition if destroyed before init completes
        if (destroyed) {
          destroyEditor(state);
          return;
        }

        editorState = state;
        onready?.(state);
      } catch (error) {
        // If we were unmounted mid-init, swallow the error to avoid unhandled rejections
        // in test environments that rapidly mount/unmount.
        if (destroyed) return;
        console.error('[Editor] Failed to initialize Milkdown editor:', error);
      }
    })();

    return () => {
      destroyed = true;
      if (editorState) {
        destroyEditor(editorState);
        editorState = null;
      }
    };
  };
}
