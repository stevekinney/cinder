import type { Snippet } from 'svelte';
import type { HTMLDialogAttributes } from 'svelte/elements';
export type DrawerSide = 'left' | 'right';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl';
export type DrawerProps = {
  /** Whether the drawer is open. Bindable via `bind:open`. */
  open?: boolean;
  /** Edge the drawer slides in from. Default `right`. */
  side?: DrawerSide;
  /** Drawer width token. Default `md`. */
  size?: DrawerSize;
  /**
   * Accessible name for the drawer. Required for screen-reader labelling.
   * Rendered as a visible `<h2>` in the default header. When a custom
   * `header` snippet is provided without `ariaLabelledBy`, this text is
   * rendered in a visually-hidden `<h2>` as the accessible name fallback.
   */
  title: string;
  /** Additional class names merged with `.cinder-drawer`. */
  class?: string;
  /**
   * Optional reference to the element that opened the drawer. When supplied,
   * focus returns to this element on close. When omitted, focus restores to
   * the element that held focus before the drawer opened.
   */
  triggerRef?: HTMLElement | null;
  /**
   * Optional id of an element that names the drawer. When supplied, drawer
   * wires `aria-labelledby` to this id and renders no internal heading.
   * Use this when a custom `header` snippet has its own visible heading —
   * supply `ariaLabelledBy` pointing to that heading's id so the
   * visible and accessible names stay in sync.
   */
  ariaLabelledBy?: string;
  /** Custom header. Falls back to a default header that renders `title`. */
  header?: Snippet;
  /** Drawer body content. Required. */
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
