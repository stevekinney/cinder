import { tick } from 'svelte';

import { captureFocus, lockBodyScroll, pushEscapeHandler } from '../../_internal/overlay.ts';
import { waitForTransitionCompletion } from '../../_internal/transition-completion.ts';
import { restoreFocusTo } from '../../utilities/focus.ts';

export type SlidingDialogStateOptions = {
  getOpen: () => boolean;
  setOpen: (open: boolean) => void;
  getDialogElement: () => HTMLDialogElement | undefined;
  getPanelElement: () => HTMLElement | undefined;
  getReducedMotion: () => boolean;
  getTriggerRef: () => HTMLElement | null;
  onOpen?: () => void;
  onClosed?: () => void;
};

export class SlidingDialogState {
  hydrated = $state(false);
  renderPanel = $state(false);
  isClosing = $state(false);
  readonly #options: SlidingDialogStateOptions;
  #closeGeneration = $state(0);
  #capturedFocus: HTMLElement | null = null;
  #releaseScrollLock: (() => void) | null = null;
  #releaseEscape: (() => void) | null = null;
  #cancelPendingClose: (() => void) | null = null;

  constructor(options: SlidingDialogStateOptions) {
    this.#options = options;
    this.renderPanel = options.getOpen();
  }

  markHydrated(): void {
    this.hydrated = true;
  }

  syncOpenState(): void {
    const dialogElement = this.#options.getDialogElement();
    if (!dialogElement) return;

    if (this.#options.getOpen()) {
      if (this.isClosing) {
        this.#closeGeneration += 1;
        this.#cancelPendingClose?.();
        this.#cancelPendingClose = null;
        this.isClosing = false;
        // Quick reopen: the native dialog never closed, so the
        // `!dialogElement.open` branch below will not run. Re-fire onOpen so
        // hosts re-apply their initial-focus policy for this new open cycle —
        // the closing panel was `inert`, which blurred focus to document.body,
        // and nothing else will bring it back.
        this.#options.onOpen?.();
      }

      if (!this.renderPanel) {
        this.renderPanel = true;
      }

      if (!dialogElement.open) {
        this.#capturedFocus = captureFocus();
        dialogElement.showModal();
        this.#acquireScrollLock();
        this.#acquireEscapeMarker();
        this.#options.onOpen?.();
      }
      return;
    }

    if (dialogElement.open) {
      this.beginClosing();
    } else {
      this.renderPanel = false;
    }
  }

  beginClosing(): void {
    const dialogElement = this.#options.getDialogElement();
    if (!dialogElement?.open || this.isClosing) return;
    const panelElement = this.#options.getPanelElement();
    if (!panelElement) {
      this.#finishClosing(this.#closeGeneration);
      return;
    }

    this.isClosing = true;
    const generation = ++this.#closeGeneration;
    this.#cancelPendingClose?.();
    this.#cancelPendingClose = waitForTransitionCompletion({
      element: panelElement,
      reducedMotion: this.#options.getReducedMotion(),
      onComplete: () => this.#finishClosing(generation),
    });
  }

  handleClose(): void {
    this.#releaseScrollLock?.();
    this.#releaseScrollLock = null;
    this.#releaseEscape?.();
    this.#releaseEscape = null;
    this.#options.setOpen(false);
    this.#returnFocus();
  }

  requestClose(): void {
    if (!this.#options.getOpen() && (this.isClosing || !this.#options.getDialogElement()?.open)) {
      return;
    }
    this.#options.setOpen(false);
    this.beginClosing();
  }

  handleBackdropClick(event: MouseEvent): void {
    if (event.target === this.#options.getDialogElement()) {
      this.requestClose();
    }
  }

  handleNativeCancel(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }

  destroy(): void {
    this.#cancelPendingClose?.();
    this.#cancelPendingClose = null;
    const wasOpen = this.#releaseScrollLock !== null || this.#releaseEscape !== null;
    this.#releaseScrollLock?.();
    this.#releaseScrollLock = null;
    this.#releaseEscape?.();
    this.#releaseEscape = null;
    if (wasOpen) {
      this.#returnFocus();
    }
  }

  #finishClosing(generation: number): void {
    if (generation !== this.#closeGeneration) return;
    this.#cancelPendingClose?.();
    this.#cancelPendingClose = null;
    this.isClosing = false;
    if (this.#options.getOpen()) {
      this.renderPanel = true;
      return;
    }
    this.renderPanel = false;
    // `dialogElement.close()` MUST run before `onClosed?.()`, not after.
    // `close()` synchronously fires the native `close` event, which Modal
    // wires to `handleClose()` — releasing the scroll lock and escape-stack
    // hold. `onClosed` forwards to a consumer-supplied callback
    // (`onExitComplete` on ModalProps); if that callback throws, a throw
    // from HERE before the close() call would propagate out of
    // `#finishClosing` with the native dialog never closed and the scroll
    // lock/escape-stack never released — a throwing consumer callback would
    // leave the whole page stuck. Calling `close()` first means all of that
    // cleanup is unconditionally complete before the consumer callback ever
    // runs, so a throw there cannot block it.
    const dialogElement = this.#options.getDialogElement();
    if (dialogElement?.open) {
      dialogElement.close();
    }
    this.#options.onClosed?.();
  }

  #acquireScrollLock(): void {
    if (this.#releaseScrollLock) return;
    this.#releaseScrollLock = lockBodyScroll();
  }

  #acquireEscapeMarker(): void {
    if (this.#releaseEscape) return;
    this.#releaseEscape = pushEscapeHandler(() => {});
  }

  #returnFocus(): void {
    const candidates: Array<HTMLElement | null> = [
      this.#options.getTriggerRef(),
      this.#capturedFocus,
    ];
    this.#capturedFocus = null;
    for (const candidate of candidates) {
      if (restoreFocusTo(candidate)) break;
    }
  }
}

export function createSlidingDialogState(options: SlidingDialogStateOptions): SlidingDialogState {
  return new SlidingDialogState(options);
}

/**
 * The shared "focus the body unless something is autofocused" initial-focus
 * policy for sliding dialogs (Modal, Drawer). Call from `onOpen`.
 *
 * Deferred via `tick()` because `onOpen` fires inside the same effect that
 * first sets `renderPanel = true` — the `{#if renderPanel}` subtree (and with
 * it the body element binding) has not flushed yet. After the tick resolves,
 * the panel is in the DOM.
 *
 * Autofocus detection checks both the HTML attribute (static markup) and the
 * DOM property (Svelte 5's `$.autofocus()` helper sets `element.autofocus`
 * rather than the attribute) — the attribute selector alone misses the Svelte
 * case. When focus already sits INSIDE the dialog (the native `showModal()`
 * honoured an autofocused child on a fresh open), leave it alone. When it
 * does not — a quick reopen never re-runs `showModal()`, and the closing
 * panel's `inert` blurred focus to `document.body` — re-place it: on the
 * autofocused child when one exists, otherwise on the body container.
 */
export function focusDialogBodyUnlessAutofocused(options: {
  getOpen: () => boolean;
  getDialogElement: () => HTMLDialogElement | undefined;
  getBodyElement: () => HTMLElement | undefined;
}): void {
  const applyInitialFocusPolicy = (): void => {
    const dialogElement = options.getDialogElement();
    if (!options.getOpen() || !dialogElement?.open) return;
    // Inside a shadow root, `document.activeElement` is the shadow HOST, not
    // the focused descendant — read from the dialog's own root node so the
    // inside-the-dialog and did-focus-move checks below stay correct there.
    const rootNode = dialogElement.getRootNode();
    const activeElementInRoot = (): Element | null =>
      rootNode instanceof Document || rootNode instanceof ShadowRoot
        ? rootNode.activeElement
        : document.activeElement;
    const autofocusTarget =
      dialogElement.querySelector<HTMLElement>('[autofocus]') ??
      Array.from(dialogElement.querySelectorAll<HTMLElement>('*')).find(
        (element) => element.autofocus,
      ) ??
      null;
    if (autofocusTarget) {
      // Fresh open: `showModal()` already honoured the autofocused child, and
      // anything focused INSIDE the dialog since then is legitimate — never
      // yank it back. Quick reopen: `showModal()` never re-ran and the
      // closing panel's `inert` blurred focus OUT to `document.body` —
      // re-place it on the autofocused child.
      const active = activeElementInRoot();
      const focusInsideDialog = active instanceof HTMLElement && dialogElement.contains(active);
      if (!focusInsideDialog) {
        autofocusTarget.focus();
        // An unfocusable autofocus target (disabled, hidden) makes focus()
        // a no-op — fall through to the body fallback rather than stranding
        // focus on document.body outside the open dialog.
        if (activeElementInRoot() === autofocusTarget) return;
      } else {
        return;
      }
    }
    // No autofocus: the body container is always the initial focus target,
    // regardless of where `showModal()`'s default focusing steps landed.
    options.getBodyElement()?.focus();
  };
  void tick().then(applyInitialFocusPolicy);
}
