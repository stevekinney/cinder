import type { Snippet } from 'svelte';
/**
 * Input placements accepted by the `placement` prop. Floating-ui's `flip`
 * middleware may resolve the panel to any of the 12 standard placements at
 * runtime — the resolved value is exposed on `data-cinder-placement` and is
 * typed internally as floating-ui's full `Placement` union. The four
 * diagonal-side variants (`right-start`, `right-end`, `left-start`,
 * `left-end`) are intentionally omitted from this public input union; pass
 * `right` or `left` as the starting hint and let flip refine if needed.
 */
export type PopoverPlacement =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end';
export type PopoverRole = 'dialog' | 'group' | 'listbox';
export type PopoverFocusManagement = 'panel' | 'preserve';
export type PopoverWidthMode = 'content' | 'match-anchor' | 'menu' | 'none';
export type PopoverProps = {
  /** Optional panel id. Defaults to a generated `cinder-popover-*` id. */
  id?: string;
  /** Open state. Bindable. Default `false`. */
  open?: boolean;
  /** Anchor placement. Default `'bottom-start'`. */
  placement?: PopoverPlacement;
  /** Distance in px between trigger and panel. Default `8`. */
  offset?: number;
  /** Render a directional arrow on the panel. Default `false`. */
  arrowVisible?: boolean;
  /** Accessible name. Sets `aria-label` when `ariaLabelledby` is not supplied. */
  label?: string;
  /** Id of an element labelling the panel. Wins over `label`. */
  ariaLabelledby?: string;
  /** Explicit anchor element. Wins over the snippet-resolved focusable. */
  triggerRef?: HTMLElement | null;
  /** Panel content. Required. */
  children: Snippet;
  /** Optional trigger snippet rendered inside a wrapper. */
  trigger?: Snippet;
  /** ARIA role for the panel. Default `'dialog'`. */
  role?: PopoverRole;
  /** Focus behavior for each open session. Default `'panel'`. */
  focusManagement?: PopoverFocusManagement;
  /** Optional callback for choosing the element that receives initial panel focus. */
  initialFocus?: (panel: HTMLElement) => HTMLElement | null;
  /** Additional elements treated as inside for outside dismissal. */
  outsideClickIgnoreRefs?: Array<() => Element | null>;
  /** Whether Popover owns trigger ARIA wiring. Default `true`. */
  wireTriggerAria?: boolean;
  /**
   * Whether Escape closes the Popover. Default `true`. Set `false` when a parent
   * composite widget (e.g. Combobox) owns Escape for the whole interaction, so the
   * Popover does not shadow the parent's handler while its panel is open.
   */
  closeOnEscape?: boolean;
  /** Floating panel width strategy. Default `'content'`. */
  widthMode?: PopoverWidthMode;
  /** Extra class merged onto the portaled scope wrapper. */
  portalScopeClass?: string;
  /** Extra class merged onto `.cinder-popover`. */
  class?: string;
  /**
   * Called once the panel's exit transition has genuinely finished and it
   * has fully unmounted (see `_internal/OVERLAY-POLICY.md` § "Transition
   * lifecycle"). Popover keeps its own panel mounted for the whole exit
   * transition — driven by `data-cinder-closing`, not an `{#if}` gate around
   * its own root — so a CONSUMER that composes Popover and wraps it in its
   * own `{#if}` keyed directly on the same condition that flips `open` false
   * would destroy the whole component instance before this exit ever gets a
   * chance to play. Use this callback to decouple that wrapping condition
   * from the live open state: keep the composing consumer's own mount gate
   * true until this fires, then clear it.
   */
  onExitComplete?: () => void;
};
