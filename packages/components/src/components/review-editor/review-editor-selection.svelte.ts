/**
 * Selection popover management for ReviewEditor (DEP-422).
 *
 * Handles:
 * - Selection popover lifecycle and positioning
 * - Browser selection change detection
 * - Captured selection for thread creation
 * - RAF timing for coordinate calculation
 *
 * State machine:
 * HIDDEN → (selectionchange + non-collapsed) → PREVIEW → (click icon) → EXPANDED → (submit/cancel) → HIDDEN
 *
 * **Note:** This module is experimental and provides an alternative implementation
 * to the inline selection popover logic in `review-editor.svelte`. It is exported for
 * testing and potential future refactoring, but the component does not currently
 * delegate to this factory.
 *
 * @module
 * @experimental
 */

import { buildAnchorFromSelection } from '@lostgradient/cinder/commentary/anchoring';
import type { ThreadCreateEvent } from '@lostgradient/cinder/commentary/comments';
import { extractMentions, generateId } from '@lostgradient/cinder/commentary/comments';
import { devWarn } from '../../utilities/dev-warn.ts';
import { getSelectionAnchorPosition } from './review-editor-selection-geometry.ts';
import type { SelectionPopover, SelectionPopoverOptions } from './review-editor-selection-types.ts';
import type { PopoverPosition } from './review-editor.types.ts';

/** Debounce delay for selection position calculation (ms) */
const SELECTION_DEBOUNCE_MS = 20;

/**
 * Create a selection popover manager.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createSelectionPopover } from './review-editor-selection.svelte';
 *
 *   const selectionPopover = createSelectionPopover({
 *     getId: () => id,
 *     getMainRef: () => mainRef,
 *     getEditorView: () => editorRef?.getView(),
 *     getMode: () => mode,
 *     getActiveView: () => activeView,
 *     getCurrentUserId: () => currentUserId,
 *     isThreadPopoverOpen: () => threadManager.popoverThreadId !== null,
 *     announce,
 *     onthreadcreate,
 *   });
 *
 *   // Start listening when component mounts
 *   $effect(() => {
 *     selectionPopover.startListening();
 *     return () => selectionPopover.destroy();
 *   });
 * </script>
 * ```
 */
export function createSelectionPopover(options: SelectionPopoverOptions): SelectionPopover {
  const {
    getId,
    getMainRef,
    getEditorView,
    getMode,
    getActiveView,
    getCurrentUserId,
    isThreadPopoverOpen,
    announce,
    onthreadcreate,
  } = options;

  // Internal state
  let position = $state<PopoverPosition | null>(null);
  let capturedSelection = $state<{ from: number; to: number } | null>(null);
  let expanded = $state(false);

  // Timer for debounced selection position calculation
  let selectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Whether currently listening to selection changes
  let isListening = false;

  // Version token for async safety
  let computeVersion = 0;

  /**
   * Whether the selection popover should be visible.
   */
  const visible = $derived.by(() => {
    return (
      getActiveView() === 'editor' &&
      getMode() === 'edit' &&
      getCurrentUserId() !== undefined &&
      (position !== null || expanded) &&
      !isThreadPopoverOpen()
    );
  });

  /**
   * Clear any pending timeouts.
   */
  function clearTimeouts(): void {
    if (selectionTimeoutId !== null) {
      clearTimeout(selectionTimeoutId);
      selectionTimeoutId = null;
    }
  }

  /**
   * Clear all selection popover state.
   */
  function clear(): void {
    clearTimeouts();
    position = null;
    capturedSelection = null;
    expanded = false;
    computeVersion++;
  }

  /**
   * Close the selection popover.
   */
  function close(): void {
    clear();
  }

  /**
   * Handle expanding the popover to show the form.
   */
  function handleExpand(): void {
    expanded = true;
  }

  /**
   * Handle canceling the expanded state.
   */
  function handleCancel(): void {
    expanded = false;
    // Keep position and captured selection so user can re-expand if they want
  }

  /**
   * Handle the comment submission from the selection popover.
   */
  function handleComment(body: string): void {
    // Helper to clear state and announce failure
    function failWithMessage(message: string): void {
      devWarn(message);
      clear();
      announce('Could not add comment. Please try selecting text again.', 'assertive');
    }

    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
      failWithMessage('Cannot create comment: no currentUserId set');
      return;
    }

    if (!capturedSelection) {
      failWithMessage('Cannot create comment: no captured selection');
      return;
    }

    if (getMode() === 'readonly') {
      failWithMessage('Cannot create thread: editor is readonly');
      return;
    }

    const view = getEditorView();
    if (!view) {
      failWithMessage('Cannot create thread: editor view not available');
      return;
    }

    const { from, to } = capturedSelection;

    // Validate positions are still within document bounds
    const docSize = view.state.doc.content.size;
    if (from < 0 || to > docSize || from > to) {
      failWithMessage('Cannot create thread: captured selection is out of bounds');
      return;
    }

    // Build anchor using shared helper
    const anchor = buildAnchorFromSelection(view, from, to);
    const requestId = generateId();
    const mentions = extractMentions(body);

    // Fire the create event
    const event: ThreadCreateEvent = {
      requestId,
      anchor,
      body,
      authorId: currentUserId,
      mentions: mentions.length > 0 ? mentions : undefined,
    };
    onthreadcreate?.(event);

    // Clear state
    clear();
    announce('Comment added');
  }

  /**
   * Handle browser selection change event.
   */
  function handleBrowserSelectionChange(): void {
    // Clear any pending calculation
    clearTimeouts();

    // Only process in edit mode
    if (getMode() !== 'edit') {
      position = null;
      capturedSelection = null;
      return;
    }

    // Don't clear the popover if focus is within it
    const selectionPopoverElement = document.getElementById(`${getId()}-selection-popover`);
    if (selectionPopoverElement?.contains(document.activeElement)) {
      return;
    }

    // Don't clear if expanded (user is composing a comment)
    if (expanded) {
      return;
    }

    const browserSelection = window.getSelection();

    // If selection is collapsed, hide popover immediately
    if (!browserSelection || browserSelection.isCollapsed) {
      position = null;
      capturedSelection = null;
      expanded = false;
      return;
    }

    // Check if selection is within the main editor area
    const mainRef = getMainRef();
    const anchorNode = browserSelection.anchorNode;
    if (!mainRef || !anchorNode || !mainRef.contains(anchorNode)) {
      position = null;
      capturedSelection = null;
      expanded = false;
      return;
    }

    // Capture version for async safety
    const version = ++computeVersion;

    // Debounce position calculation
    selectionTimeoutId = setTimeout(() => {
      selectionTimeoutId = null;

      // Check if this computation is stale
      if (computeVersion !== version) return;

      // Re-check selection after debounce
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        position = null;
        capturedSelection = null;
        return;
      }

      // Get the selection range and compute position from the browser's DOM
      const range = sel.getRangeAt(0);
      const anchorPosition = getSelectionAnchorPosition(range);

      if (anchorPosition) {
        // Capture the ProseMirror selection range for thread creation
        const view = getEditorView();
        if (view) {
          const { from, to } = view.state.selection;
          if (from !== to) {
            capturedSelection = { from, to };
            position = anchorPosition;
          }
        }
      }
    }, SELECTION_DEBOUNCE_MS);
  }

  /**
   * Start listening to browser selection changes.
   */
  function startListening(): void {
    if (isListening || typeof document === 'undefined') return;

    document.addEventListener('selectionchange', handleBrowserSelectionChange);
    isListening = true;
  }

  /**
   * Stop listening to browser selection changes.
   */
  function stopListening(): void {
    if (!isListening || typeof document === 'undefined') return;

    document.removeEventListener('selectionchange', handleBrowserSelectionChange);
    isListening = false;
  }

  /**
   * Destroy the manager and clean up resources.
   */
  function destroy(): void {
    stopListening();
    clearTimeouts();
  }

  // Clear selection popover state when mode changes to readonly
  $effect(() => {
    if (getMode() === 'readonly') {
      clear();
    }
  });

  return {
    // State
    get position() {
      return position;
    },
    get capturedSelection() {
      return capturedSelection;
    },
    get expanded() {
      return expanded;
    },
    get visible() {
      return visible;
    },

    // Actions
    handleComment,
    handleExpand,
    handleCancel,
    close,
    clear,

    // Lifecycle
    startListening,
    stopListening,
    destroy,
  };
}
