/**
 * MarkdownEditor's display-mode state and transitions.
 *
 * - An invalid `mode` keeps the last valid one (`'wysiwyg'` on mount) and is
 *   never written back to the parent.
 * - The editing surface (rich editor or source textarea) that was showing is
 *   retained, hidden and inert, behind preview, so its selection and history
 *   survive. A preview-only mount has no editing surface at all.
 * - Entering preview from the rich editor takes its pending edit and publishes
 *   it once, unless a distinct parent value arrived in the same flush, which
 *   wins. Rich/source switches keep their existing flush-and-canonicalize
 *   semantics (DEP-45).
 * - `onModeChange` fires once per real change, after that decision. Only a
 *   user choice (the mode control or `ToolbarContext.onModeChange`) moves
 *   focus, after the DOM updates.
 */

import { tick, untrack } from 'svelte';

import type { EditorState } from '../../editor/index.ts';
import { isEditorMode, type EditingMode } from './markdown-editor-mode.ts';
import type { EditorMode } from './markdown-editor.types.ts';

/** The component state the mode controller reads and updates. */
export interface ModeControllerHost {
  /** The `mode` prop as supplied, possibly invalid. */
  mode: () => unknown;
  /** Write the bindable `mode` prop, for a user choice. */
  setMode: (mode: EditorMode) => void;
  value: () => string;
  /** The value the component last observed; differs when the parent just replaced it. */
  lastSeenValue: () => string;
  editorState: () => EditorState | null;
  /** Drop the reference to a rich editor that is about to be destroyed. */
  releaseEditorState: () => void;
  setInitializing: (initializing: boolean) => void;
  normalize: (markdown: string) => string;
  /** Publish a value the component derived itself: one `value` write and one `onValueChange`, if changed. */
  publishValue: (markdown: string) => void;
  /** Close transient UI tied to the previous mode, such as the link popover. */
  closeTransientUi: () => void;
  onModeChange: () => ((mode: EditorMode) => void) | undefined;
  focusMode: (mode: EditorMode) => void;
  warn: (message: string, error: unknown) => void;
}

export function createMarkdownEditorModeController(host: ModeControllerHost) {
  let lastValidMode: EditorMode = 'wysiwyg';
  const currentMode = $derived.by((): EditorMode => {
    const requested = host.mode();
    if (isEditorMode(requested)) lastValidMode = requested;
    return lastValidMode;
  });
  let editingMode = $state<EditingMode | null>(
    untrack(() => (currentMode === 'preview' ? null : currentMode)),
  );
  let userRequestedMode = false;
  let previousMode: EditorMode = untrack(() => currentMode);

  function takePendingRichEdit(): void {
    const editorState = host.editorState();
    if (editingMode !== 'wysiwyg' || !editorState) return;
    const externalValueArrived = host.value() !== host.lastSeenValue();
    const pending = editorState.flushPendingChange();
    if (pending !== null && !externalValueArrived) host.publishValue(pending);
  }

  function leaveRichEditor(): void {
    const editorState = host.editorState();
    let latestMarkdown = host.value();
    if (editorState) {
      try {
        latestMarkdown = editorState.getMarkdown();
      } catch (error) {
        host.warn('Failed to read markdown from editor during mode switch:', error);
      }
      editorState.clearPendingTimers();
    }
    host.publishValue(host.normalize(latestMarkdown));
    host.releaseEditorState();
  }

  function applyTransition(nextMode: EditorMode): void {
    if (nextMode === 'preview') {
      takePendingRichEdit();
      return;
    }
    if (nextMode === editingMode) return;
    if (nextMode === 'source') {
      if (editingMode === 'wysiwyg') leaveRichEditor();
      host.setInitializing(false);
    } else {
      // Canonicalize the textarea content before initializing Milkdown.
      if (editingMode === 'source') host.publishValue(host.normalize(host.value()));
      host.setInitializing(true);
    }
    editingMode = nextMode;
  }

  $effect(() => {
    const nextMode = currentMode;
    if (nextMode === previousMode) return;
    previousMode = nextMode;
    const focusRequested = userRequestedMode;
    userRequestedMode = false;

    untrack(() => {
      host.closeTransientUi();
      applyTransition(nextMode);
      host.onModeChange()?.(nextMode);
      if (focusRequested) void tick().then(() => host.focusMode(nextMode));
    });
  });

  return {
    /** The mode on display: the `mode` prop, or the last valid one. */
    get mode(): EditorMode {
      return currentMode;
    },
    /** The mounted editing surface, retained behind preview; `null` before one shows. */
    get editingMode(): EditingMode | null {
      return editingMode;
    },
    /** A user's mode choice. Ignores invalid and unchanged modes. */
    request(nextMode: EditorMode): void {
      if (!isEditorMode(nextMode) || nextMode === currentMode) return;
      userRequestedMode = true;
      host.setMode(nextMode);
      // A parent binding can keep its own value. Then no transition will
      // consume the request, and a later programmatic change must not
      // inherit its focus move.
      if (untrack(() => host.mode()) !== nextMode) userRequestedMode = false;
    },
  };
}
