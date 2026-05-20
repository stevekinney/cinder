import type { Snippet } from 'svelte';
import type { HTMLDialogAttributes } from 'svelte/elements';
export type SheetProps = {
  /** Whether the sheet is open. Bindable via `bind:open`. */
  open?: boolean;
  /**
   * Accessible name for the sheet. Required for screen-reader labelling.
   * Rendered as a visible `<h2>` in the default header. When a custom
   * `header` snippet is provided without `ariaLabelledBy`, this text is
   * rendered in a visually-hidden `<h2>` as the accessible name fallback.
   */
  title: string;
  /** Additional class names merged with `.cinder-sheet`. */
  class?: string;
  /**
   * Optional reference to the element that opened the sheet. When supplied,
   * focus returns to this element on close. When omitted, focus restores to
   * the element that held focus before the sheet opened.
   */
  triggerRef?: HTMLElement | null;
  /**
   * Optional id of an element that names the sheet. When supplied, sheet
   * wires `aria-labelledby` to this id and renders no internal heading.
   * Use this when a custom `header` snippet has its own visible heading —
   * supply `ariaLabelledBy` pointing to that heading's id so the
   * visible and accessible names stay in sync.
   */
  ariaLabelledBy?: string;
  /**
   * When `true`, render a decorative drag handle above the header.
   * Swipe-to-close gesture is a stretch goal not implemented in MVP —
   * the handle is purely a visual affordance. Default `false`.
   *
   * Named `showDragHandle` (not `draggable`) to avoid colliding with the
   * native HTML `draggable` attribute on the underlying `<dialog>`.
   */
  showDragHandle?: boolean;
  /** Custom header. Falls back to a default header that renders `title`. */
  header?: Snippet;
  /** Sheet body content. Required. */
  children: Snippet;
  /** Optional footer (e.g. action buttons). */
  footer?: Snippet;
} & Omit<
  HTMLDialogAttributes,
  | 'open'
  | 'class'
  | 'children'
  | 'aria-labelledby'
  | 'aria-modal'
  | 'role'
  | 'onclose'
  | 'oncancel'
  | 'onclick'
>;
