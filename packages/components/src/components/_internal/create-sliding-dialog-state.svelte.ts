import { tick } from 'svelte';

import { captureFocus, lockBodyScroll, pushEscapeHandler } from '../../_internal/overlay.ts';
import { waitForTransitionCompletion } from '../../_internal/transition-completion.ts';
import { restoreFocusTo } from '../../utilities/focus.ts';

// `onClosed` now fires from inside a `tick().then()` continuation (see
// `#finishClosing` below), not synchronously from a DOM event listener. A
// throw there would otherwise become an unhandled promise rejection instead
// of the "reported, not propagated to any caller" behavior a throw from an
// event listener gets for free — the same hazard `anchored-overlay.svelte.ts`
// already solved for its own async setup path. Mirrors that helper.
function reportUnhandledExitCompleteError(error: unknown): void {
  if (typeof globalThis.reportError === 'function') {
    globalThis.reportError(error);
    return;
  }

  setTimeout(() => {
    throw error;
  }, 0);
}

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
  #disposed = false;
  // The `#closeGeneration` active at the moment we last called the native
  // `dialogElement.close()` — see `#finishClosing()`. The native `close`
  // EVENT is dispatched via a QUEUED TASK, not synchronously (the WHATWG
  // spec's "close the dialog" steps queue a task to fire it), so it can
  // still be pending when other, faster (microtask-scheduled) work runs
  // first — specifically, a consumer's `onExitComplete` synchronously
  // reopening the modal. `handleClose()` compares this against the CURRENT
  // `#closeGeneration` to detect exactly that: a queued event left over from
  // a close cycle a reopen has already superseded.
  #pendingNativeCloseGeneration: number | null = null;

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
      // A fresh open observed while EITHER a close was still mid-transition
      // (`isClosing`) OR the native dialog had already fully closed
      // (`!dialogElement.open`) must invalidate any close cycle in flight.
      // The second case matters even when `isClosing` is already false:
      // `#finishClosing()` resets `isClosing` and closes the native dialog
      // SYNCHRONOUSLY, but defers its `onClosed` forwarding call past a
      // `tick()`. If `open` flips back to true during that deferred window
      // (before the tick's flush lands), this branch runs with `isClosing`
      // already false — bumping the generation only in the `isClosing`
      // branch below would miss it entirely, and the stale deferred
      // callback would still fire `onClosed` even though the dialog is
      // freshly open again. Bumping here, keyed on the dialog element's own
      // closed state rather than `isClosing` alone, covers both cases.
      const wasClosingOrClosed = this.isClosing || !dialogElement.open;
      if (wasClosingOrClosed) {
        this.#closeGeneration += 1;
      }

      if (this.isClosing) {
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
    // Ignore a STALE native `close` event: its queued task can still be
    // pending after a synchronous reopen (from `onExitComplete`, fired from
    // our own tick()-deferred continuation, which runs as a microtask well
    // before this event's task gets a turn) has already moved
    // `#closeGeneration` past the generation active when we called
    // `.close()`. Processing it now would call `setOpen(false)`, undoing
    // that fresh reopen out from under the consumer. By the time a genuinely
    // current event arrives, the generation still matches — see
    // `#pendingNativeCloseGeneration`'s own comment for the full race.
    if (
      this.#pendingNativeCloseGeneration !== null &&
      this.#pendingNativeCloseGeneration !== this.#closeGeneration
    ) {
      return;
    }
    // Captured BEFORE clearing `#pendingNativeCloseGeneration` below: `null`
    // here means this `close` event was never expected from OUR OWN
    // `dialogElement.close()` call inside `#finishClosing()` — i.e. the
    // native dialog closed by some other means entirely, bypassing
    // `requestClose()`/`beginClosing()` outright. The supported case (PR
    // #1422 review, NATIVE-FORM-POLICY.md) is a `<form method="dialog">`
    // submission: the browser's form-submission "close the dialog" steps
    // flip `dialogElement.open` to `false` and queue this `close` event
    // SYNCHRONOUSLY as part of handling the submit — before anything in
    // this class ever calls `requestClose()`. When `syncOpenState()` next
    // reconciles (from the `setOpen(false)` below), it finds
    // `dialogElement.open` already `false` and only clears `renderPanel`;
    // it never calls `beginClosing()`, so `#finishClosing()` — the only
    // other place that reports exit-completion — never runs either, and a
    // consumer's `onExitComplete`/mount-gate release would otherwise never
    // fire for this supported native-form composition.
    const isNativeCloseBypassingOurOwnFlow = this.#pendingNativeCloseGeneration === null;
    this.#pendingNativeCloseGeneration = null;
    this.#releaseScrollLock?.();
    this.#releaseScrollLock = null;
    this.#releaseEscape?.();
    this.#releaseEscape = null;
    this.#options.setOpen(false);
    this.#returnFocus();

    if (isNativeCloseBypassingOurOwnFlow) {
      // There is no exit transition to wait for — the native dialog is
      // already closed by the time this event fires — so report
      // exit-completion directly instead of going through
      // `beginClosing()`'s transition wait. Reuses the SAME
      // generation-and-disposal-guarded deferred report `#finishClosing()`
      // uses, so a fast reopen before the deferred `tick()` resolves still
      // correctly suppresses the stale callback. When the close instead
      // came from OUR OWN `requestClose()`/`beginClosing()`/`close()` flow,
      // `#pendingNativeCloseGeneration` was non-null here (set by
      // `#finishClosing()` right before calling `dialogElement.close()`),
      // so this branch is skipped — `#finishClosing()` already scheduled
      // its own report before this event ever arrived, and firing again
      // here would double-report the same close.
      this.isClosing = false;
      this.renderPanel = false;
      this.#reportClosedOnce(this.#closeGeneration);
    }
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
    // Marks any in-flight `#finishClosing()` deferred continuation (past its
    // `tick()`) as stale, even though it captured the CURRENT
    // `#closeGeneration` and would otherwise still match it — a consumer
    // that unmounts Modal (e.g. from its own `onExitComplete`-driven
    // teardown, or simply navigating away) while that continuation is
    // pending must not have `onClosed` fire afterward, calling back into a
    // destroyed component instance.
    this.#disposed = true;
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
    // `close()` SYNCHRONOUSLY flips `dialogElement.open` to `false` and
    // removes it from the top layer — but the native `close` EVENT itself
    // (which Modal wires to `handleClose()`, releasing the scroll lock and
    // escape-stack hold) is dispatched via a QUEUED TASK per the WHATWG
    // spec's "close the dialog" steps, not fired synchronously from this
    // call. `onClosed` forwards to a consumer-supplied callback
    // (`onExitComplete` on ModalProps); if that callback throws, a throw
    // from HERE before the close() call would propagate out of
    // `#finishClosing` with the native dialog never closed and the scroll
    // lock/escape-stack never released — a throwing consumer callback would
    // leave the whole page stuck. Calling `close()` first means all of that
    // cleanup is unconditionally complete before the consumer callback ever
    // runs, so a throw there cannot block it.
    //
    // That queued-task timing is exactly what `#pendingNativeCloseGeneration`
    // guards against: if the consumer's `onExitComplete` (below, deferred
    // only past a microtask `tick()`) synchronously reopens the modal before
    // this event's task gets a turn, `handleClose()` must recognize the
    // eventually-arriving event as stale and ignore it, rather than calling
    // `setOpen(false)` and undoing the fresh reopen.
    const dialogElement = this.#options.getDialogElement();
    if (dialogElement?.open) {
      this.#pendingNativeCloseGeneration = generation;
      dialogElement.close();
    }
    this.#reportClosedOnce(generation);
  }

  // Shared by `#finishClosing()` (the normal exit-transition path) and
  // `handleClose()`'s native-close-bypass branch (a `<form method="dialog">`
  // submission, which closes the native dialog with no exit transition to
  // wait for at all — see that branch's own comment). `onClosed` (Modal's
  // `onExitComplete` forwarding) is documented as firing "once the exit
  // transition genuinely finishes and the panel actually unmounts" — but by
  // the time either caller reaches this method, `renderPanel = false` has
  // only *scheduled* that unmount; Svelte hasn't reconciled the `{#if
  // renderPanel}` block yet in this synchronous stack, so a consumer
  // callback invoked right here would still find `.cinder-modal__panel` in
  // the DOM. Defer past `tick()` so the render flush has actually happened
  // first, and re-check the generation (plus disposal and current `open`
  // state) after the flush: if a reopen happened during the deferred
  // window, or the component was destroyed, this call is stale and must not
  // fire `onClosed`.
  #reportClosedOnce(generation: number): void {
    const closedGeneration = generation;
    // Side-effect-only continuation — nothing downstream chains off this
    // promise, so there is no value to return.
    // oxlint-disable-next-line promise/always-return
    void tick().then(() => {
      // Generation check first (cheap, and covers the common case). Also
      // re-verify the modal is actually STILL closed right now — belt and
      // suspenders alongside the generation bump on the reopen path in
      // `syncOpenState()`, in case some future reopen path forwards to
      // `setOpen`/`renderPanel` without going through that generation bump.
      if (
        this.#disposed ||
        closedGeneration !== this.#closeGeneration ||
        this.#options.getOpen() ||
        this.renderPanel
      ) {
        return;
      }
      try {
        this.#options.onClosed?.();
      } catch (error) {
        // All Modal-owned cleanup (close(), scroll lock, escape-stack
        // release) already ran above, unconditionally, before this deferred
        // call — a throw here cannot leave any of that undone. Report it
        // the same way a throw from a real event listener would be
        // (visible for debugging, not propagated to any caller) rather than
        // letting it surface as an unhandled promise rejection.
        reportUnhandledExitCompleteError(error);
      }
    });
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
