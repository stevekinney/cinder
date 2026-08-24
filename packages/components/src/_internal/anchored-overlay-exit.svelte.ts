import { waitForTransitionCompletion } from './transition-completion.ts';

/**
 * Shared exit-transition lifecycle for the anchored-overlay family (Popover,
 * Tooltip, HoverCard, Selection Popover, NavigationBar's mobile panel,
 * MultiSelect, DropdownMenu, ContextMenu, CommandMenu, SpeedDial, ...).
 *
 * Models the same contract as `SlidingDialogState`
 * (`../components/_internal/create-sliding-dialog-state.svelte.ts`) — see
 * `_internal/OVERLAY-POLICY.md` § "Transition lifecycle" for the full
 * contract these two helpers implement:
 *
 * - The component owns triggering the close and renders `data-cinder-closing`
 *   on the animated element for the duration of the exit transition, keyed
 *   off `this.isClosing`.
 * - This helper owns detecting completion via `waitForTransitionCompletion`
 *   and only then flips `renderPanel` back to `false`.
 * - Reduced motion resolves immediately (delegated to
 *   `waitForTransitionCompletion`'s own `reducedMotion` handling).
 * - A reopen during the exit transition is generation-guarded: the close
 *   generation counter is incremented (and the previous force-finish
 *   invoked) *before* anything else runs, so the stale completion callback
 *   becomes a no-op instead of unmounting the freshly reopened panel. This
 *   is the exact defect HoverCard's hand-rolled implementation had before
 *   migrating onto this helper (CIN-376).
 *
 * Anchored overlays are non-modal, so unlike `SlidingDialogState` this helper
 * owns none of scroll-lock/focus-trap/native-dialog concerns — only the
 * render-gate + exit-transition-await lifecycle. Consumers keep their own
 * escape-stack and outside-click wiring keyed off their own `open` prop, but
 * should feed `open() || isClosing` to `createAnchoredOverlay` so Floating UI
 * keeps positioning the panel while it fades/slides out.
 */
export type AnchoredOverlayExitOptions = {
  getOpen: () => boolean;
  getPanelElement: () => HTMLElement | null | undefined;
  getReducedMotion: () => boolean;
  /** Called once the panel has actually finished its exit transition and unmounted. */
  onClosed?: () => void;
};

export class AnchoredOverlayExitState {
  renderPanel = $state(false);
  isClosing = $state(false);
  readonly #options: AnchoredOverlayExitOptions;
  #generation = 0;
  #cancelPendingClose: (() => void) | null = null;

  constructor(options: AnchoredOverlayExitOptions) {
    this.#options = options;
    this.renderPanel = options.getOpen();
  }

  /**
   * Call from a reactive `$effect` that reads `getOpen()` so it reruns on
   * every open/close transition.
   */
  sync(): void {
    if (this.#options.getOpen()) {
      if (this.isClosing) {
        // Reopen during exit: bump the generation and force-finish the
        // pending close BEFORE anything else. The force-finish invokes
        // `onComplete` synchronously, but it now checks against the bumped
        // generation and becomes a no-op — see `#finishClosing` below.
        this.#generation += 1;
        this.#cancelPendingClose?.();
        this.#cancelPendingClose = null;
        this.isClosing = false;
      }
      this.renderPanel = true;
      return;
    }

    if (!this.renderPanel || this.isClosing) return;
    this.#beginClosing();
  }

  /** Force the panel closed without waiting for a transition (e.g. no panel element yet). */
  #beginClosing(): void {
    const panel = this.#options.getPanelElement();
    if (!panel) {
      this.renderPanel = false;
      this.#options.onClosed?.();
      return;
    }

    this.isClosing = true;
    const generation = ++this.#generation;
    this.#cancelPendingClose?.();
    this.#cancelPendingClose = waitForTransitionCompletion({
      element: panel,
      reducedMotion: this.#options.getReducedMotion(),
      onComplete: () => this.#finishClosing(generation),
    });
  }

  #finishClosing(generation: number): void {
    if (generation !== this.#generation) return;
    this.#cancelPendingClose = null;
    this.isClosing = false;
    if (this.#options.getOpen()) {
      // Reopened between the transition finishing and this callback running.
      this.renderPanel = true;
      return;
    }
    this.renderPanel = false;
    this.#options.onClosed?.();
  }

  /** Call from `onDestroy` to release any pending timers/listeners. */
  destroy(): void {
    this.#cancelPendingClose?.();
    this.#cancelPendingClose = null;
  }
}

export function createAnchoredOverlayExitState(
  options: AnchoredOverlayExitOptions,
): AnchoredOverlayExitState {
  return new AnchoredOverlayExitState(options);
}
