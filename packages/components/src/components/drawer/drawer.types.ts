import type { Snippet } from 'svelte';
import type { HTMLDialogAttributes } from 'svelte/elements';
export type DrawerPlacement = 'left' | 'right' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl';
export type DrawerProps = {
  /** Whether the drawer is open. Bindable via `bind:open`. */
  open?: boolean;
  /**
   * Edge the drawer slides in from.
   * @default 'right'
   */
  placement?: DrawerPlacement;
  /**
   * Drawer width token for `left`/`right` placements.
   * Ignored for `placement="bottom"`, which always spans the full viewport
   * width and caps its height at 90dvh.
   * @default 'md'
   */
  size?: DrawerSize;
  /**
   * Whether the drawer is modal. Modal drawers use the native dialog top layer,
   * backdrop, body scroll lock, and focus trap. Non-modal drawers render as an
   * aside and leave the page interactive.
   * @default true
   */
  modal?: boolean;
  /**
   * Accessible name for the drawer. Required for screen-reader labelling.
   * Rendered as a visible `<h2>` in the default header. When a custom
   * `header` snippet is provided without `ariaLabelledby`, this text is
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
   * supply `ariaLabelledby` pointing to that heading's id so the
   * visible and accessible names stay in sync.
   */
  ariaLabelledby?: string;
  /**
   * When `true` and `placement="bottom"`, render a decorative drag handle
   * above the header. Swipe-to-close gesture is a stretch goal not
   * implemented in MVP — the handle is purely a visual affordance.
   * Ignored for `left`/`right` placements.
   *
   * Named `dragHandleVisible` (not `draggable`) to avoid colliding with the
   * native HTML `draggable` attribute on the underlying `<dialog>`.
   * @default false
   */
  dragHandleVisible?: boolean;
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
