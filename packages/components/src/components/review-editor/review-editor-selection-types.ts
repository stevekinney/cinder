/**
 * Public types for the selection popover manager (DEP-422).
 *
 * Declared in a separate `.ts` file so they are processed by the standard
 * TypeScript compiler path rather than going through the Svelte module
 * compiler (`compileModule`) — `export interface` is valid TypeScript but
 * is not emitted in the Svelte-compiled JS output, which confuses the Bun
 * plugin's pre-commit resolution chain.
 */
import type { ThreadCreateEvent } from '@lostgradient/cinder/commentary/comments';
import type { EditorView } from '@milkdown/kit/prose/view';
import type {
  PopoverPosition,
  ReviewMode,
  ReviewEditorViewType as ViewType,
} from './review-editor-types';

/**
 * Options for creating the selection popover manager.
 */
export interface SelectionPopoverOptions {
  /** Get the component ID */
  getId: () => string;
  /** Get the main editor area element (for scoping selection checks) */
  getMainRef: () => HTMLElement | null;
  /** Get the editor view */
  getEditorView: () => EditorView | undefined;
  /** Get the current mode */
  getMode: () => ReviewMode;
  /** Get the current view type */
  getActiveView: () => ViewType;
  /** Get the current user ID */
  getCurrentUserId: () => string | undefined;
  /** Check if thread popover is currently open */
  isThreadPopoverOpen: () => boolean;
  /** Announce message to screen readers */
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  /** Event callback for thread creation */
  onthreadcreate?: (event: ThreadCreateEvent) => void;
}

/**
 * Selection popover manager interface.
 */
export interface SelectionPopover {
  /** Position for the selection popover (viewport-relative) */
  readonly position: PopoverPosition | null;
  /** Captured selection range for thread creation */
  readonly capturedSelection: { from: number; to: number } | null;
  /** Whether the popover is in expanded form state */
  readonly expanded: boolean;
  /** Whether the selection popover should be visible */
  readonly visible: boolean;

  /** Handle the comment submission from the selection popover */
  handleComment(body: string): void;
  /** Handle expanding the popover to show the form */
  handleExpand(): void;
  /** Handle canceling the expanded state */
  handleCancel(): void;
  /** Close the selection popover completely */
  close(): void;
  /** Clear all selection popover state */
  clear(): void;

  /** Start listening to browser selection changes */
  startListening(): void;
  /** Stop listening to browser selection changes */
  stopListening(): void;

  /** Destroy the manager and clean up resources */
  destroy(): void;
}
