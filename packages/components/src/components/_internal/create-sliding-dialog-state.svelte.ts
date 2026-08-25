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
  // A FIFO queue of the `#closeGeneration` values active at each moment we
  // called the native `dialogElement.close()` — see `#finishClosing()`. The
  // native `close` EVENT is dispatched via a QUEUED TASK, not synchronously
  // (the WHATWG spec's "close the dialog" steps queue a task to fire it), so
  // it can still be pending when other, faster (microtask-scheduled) work
  // runs first — specifically, a consumer's `onExitComplete` synchronously
  // reopening the modal (which can itself close again before the FIRST
  // queued event ever fires). `handleClose()` shifts the OLDEST entry off
  // this queue and compares it against the CURRENT `#closeGeneration` to
  // detect a queued event left over from a close cycle a reopen has already
  // superseded.
  //
  // A plain nullable scalar (this field's original shape) is NOT enough
  // under rapid close→reopen→close cycling (PR #1422 review): the browser
  // queues native `close` events in the same order their `.close()` calls
  // were made, but a scalar only remembers the LATEST call. A second
  // `.close()` (from the second cycle) would overwrite the first cycle's
  // recorded generation before that first cycle's queued event ever fires —
  // that stale first event would then wrongly compare EQUAL to whatever the
  // second cycle's generation happens to be (a false match), get treated as
  // non-stale, and consume the marker; the SECOND cycle's own (genuinely
  // current) event would then arrive to find the marker already cleared,
  // get misclassified as an external native-close bypass, and fire
  // `#reportClosedOnce()` a SECOND time for a cycle `#finishClosing()`
  // already reported once. A FIFO queue keeps each call's generation
  // associated with its own eventually-arriving event, however many cycles
  // overlap.
  //
  // This queue also now doubles as the PROVENANCE tag `handleClose()` uses
  // to decide who is responsible for reporting exit-completion (PR #1422
  // review, second round): an entry present and matching the current
  // generation means THIS event corresponds to our own `.close()` call for
  // an internally-initiated close (`requestClose()`/`beginClosing()`/
  // `close()`); no matching entry means the native dialog closed by some
  // OTHER means entirely (an external close — see `handleClose()`'s own
  // comment). Either way, `handleClose()` — not `#finishClosing()` — is now
  // the single place that ever calls `#reportClosedOnce()`: see that
  // method's comment for why.
  #pendingNativeCloseGenerations: number[] = [];

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

  // The SINGLE place that ever triggers exit-completion reporting for a
  // close — whether it was internally initiated (`requestClose()`/
  // `beginClosing()`/`close()`, via `#finishClosing()`) or an EXTERNAL close
  // this class never called `.close()` for at all (PR #1422 review, both
  // rounds).
  //
  // Round 1 of this review found a cross-overlay sequencing bug:
  // `#finishClosing()` used to call `#reportClosedOnce()` itself, BEFORE the
  // queued native `close` event ever reached this method — so a consumer's
  // `onClosed`/`onExitComplete` could run, and open a FOLLOW-UP overlay,
  // while THIS Modal still owned the scroll lock and escape-stack
  // registration below (both released here, not there). That follow-up
  // overlay's own focus placement could then get stolen back by THIS
  // method's `#returnFocus()`, which ran later still. Moving the trigger
  // here — after scroll-lock/escape release and focus restoration have
  // genuinely completed — fixes the ordering: a consumer's callback now
  // only ever runs once this Modal has fully released every piece of
  // coordination state it owned, never before.
  //
  // Round 2 found that FIFO position ALONE cannot always attribute
  // provenance correctly in a MIXED sequence (external close → reopen →
  // internal close): an external close event consumes no queue entry, so a
  // later internal cycle's entry could be wrongly read by an event it
  // doesn't belong to if the two were tracked with any less precision than
  // "does this specific entry's generation match what's live RIGHT NOW".
  // The queue-plus-generation-match design below already satisfies that —
  // see the field's own comment — but the fix is called out here because
  // Round 2 explicitly re-verified it holds under a mixed external/internal
  // sequence, not just repeated-internal cycling (Round 1's original test).
  handleClose(): void {
    // Shift the OLDEST pending generation off the FIFO queue. Queued native
    // `close` events fire in the same order their `.close()` calls were
    // made (the WHATWG "close the dialog" steps queue a task per call, and
    // tasks run FIFO), so the front of the queue is always the entry THIS
    // event corresponds to IF it corresponds to one of our own calls at
    // all — regardless of how many close()/reopen cycles have overlapped
    // since. `undefined` means the queue was empty: this `close` event was
    // never expected from OUR OWN `dialogElement.close()` call at all — an
    // EXTERNAL close (the supported case, per NATIVE-FORM-POLICY.md, is a
    // `<form method="dialog">` submission: the browser's own form-
    // submission "close the dialog" steps flip `dialogElement.open` to
    // `false` and queue this `close` event, entirely bypassing
    // `requestClose()`/`beginClosing()`).
    const expectedGeneration = this.#pendingNativeCloseGenerations.shift();

    // Ignore a STALE native `close` event: its queued task can still be
    // pending after a reopen (via `syncOpenState()`, which a consumer's
    // `onOpen`/render-driven update can trigger synchronously, or — since
    // reporting now happens from HERE rather than a microtask — via any
    // reopen that lands before this task gets a turn) has already moved
    // `#closeGeneration` past the generation active when `.close()` was
    // called for THIS entry. Processing it now would call `setOpen(false)`,
    // undoing that fresh reopen out from under the consumer. By the time a
    // genuinely current event for THIS generation arrives, the generation
    // still matches — this comparison is exactly what makes provenance
    // robust to a mixed external/internal sequence: an entry only ever
    // resolves against the CURRENT `#closeGeneration` at event time, never
    // merely by queue position, so an external event landing between two
    // internal cycles can never be mistaken for either one's own entry (it
    // finds no entry at all — the queue only ever holds OUR OWN calls'
    // generations), and one internal cycle's entry can never satisfy a
    // DIFFERENT cycle's event, however they interleave.
    if (expectedGeneration !== undefined && expectedGeneration !== this.#closeGeneration) {
      // The entry for THIS stale event was already consumed by the `shift()`
      // above — there is nothing further to clear here, and any OTHER
      // still-pending entries in the queue (from other in-flight close
      // cycles) are left untouched, so their own eventually-arriving events
      // still resolve against their own correct generation.
      return;
    }

    this.#releaseScrollLock?.();
    this.#releaseScrollLock = null;
    this.#releaseEscape?.();
    this.#releaseEscape = null;
    this.#options.setOpen(false);
    this.#returnFocus();

    if (expectedGeneration === undefined) {
      // External close (see this method's own top comment): there is no
      // exit transition to wait for — the native dialog is already closed
      // by the time this event fires, and `#finishClosing()` never ran for
      // this cycle at all — so `isClosing`/`renderPanel` need setting here,
      // which `#finishClosing()` would otherwise have done.
      this.isClosing = false;
      this.renderPanel = false;
      this.#reportClosedOnce(this.#closeGeneration);
    } else {
      // Internal close: `#finishClosing()` already set `isClosing`/
      // `renderPanel` for this generation (synchronously, before calling
      // `.close()`) and already pushed this exact entry onto the queue —
      // report now, using THAT captured generation, now that this method's
      // OWN cleanup and focus restoration (above) have genuinely completed.
      this.#reportClosedOnce(expectedGeneration);
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
    // `dialogElement.close()` is called here, synchronously — but
    // `#reportClosedOnce()` is deliberately NOT called from here anymore
    // (PR #1422 review, round 2 of this file's review): it used to be,
    // which meant a consumer's `onClosed`/`onExitComplete` callback could
    // run — and open a follow-up overlay — while the scroll lock and
    // escape-stack hold below were STILL held (those only release inside
    // `handleClose()`, once the native `close` EVENT itself arrives). A
    // later `handleClose()` call would then restore focus AFTER that
    // follow-up overlay had already placed its own, stealing it back.
    // `handleClose()` is now the sole trigger for reporting exit-completion
    // — see its own top comment — so all this method does is push this
    // generation onto the FIFO queue (the provenance tag `handleClose()`
    // matches its eventual native event against) and call `.close()`
    // itself. `close()` SYNCHRONOUSLY flips `dialogElement.open` to
    // `false` and removes it from the top layer, but the native `close`
    // EVENT (which Modal wires to `handleClose()`) is dispatched via a
    // QUEUED TASK per the WHATWG spec's "close the dialog" steps, arriving
    // strictly later. Pushed (not assigned) so an overlapping SECOND close
    // cycle's own entry doesn't clobber this one.
    const dialogElement = this.#options.getDialogElement();
    if (dialogElement?.open) {
      this.#pendingNativeCloseGenerations.push(generation);
      dialogElement.close();
      return;
    }
    // Defensive fallback: every caller of `#finishClosing()` reaches this
    // point with `dialogElement.open` still `true` in practice (`.close()`
    // is the only thing that flips it, and nothing else calls it between
    // `beginClosing()` starting the wait and this method running) — but if
    // the native dialog were ever ALREADY closed by some other means by
    // this point, no `close` event is coming at all, so nothing would ever
    // invoke `handleClose()` to trigger the report. Report directly rather
    // than leaving the consumer's `onClosed`/mount-gate release stuck
    // forever waiting for an event that will never arrive.
    this.#reportClosedOnce(generation);
  }

  // Called from `handleClose()` for both close provenances (internal and
  // external — see that method's own top comment), and, as a defensive
  // fallback only, directly from `#finishClosing()` when the native dialog
  // was somehow ALREADY closed with no `close` event ever coming. `onClosed`
  // (Modal's `onExitComplete` forwarding) is documented as firing "once the
  // exit transition genuinely finishes and the panel actually unmounts" —
  // but by the time any caller reaches this method, `renderPanel = false`
  // has only *scheduled* that unmount; Svelte hasn't reconciled the `{#if
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
