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
      this.#options.onClosed?.();
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
    this.renderPanel = false;
    this.#options.onClosed?.();
    const dialogElement = this.#options.getDialogElement();
    if (dialogElement?.open) {
      dialogElement.close();
    }
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
