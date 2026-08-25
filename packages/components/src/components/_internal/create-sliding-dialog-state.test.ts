/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

import { createSlidingDialogState } from './create-sliding-dialog-state.svelte.ts';

setupHappyDom();

function createDialogElement(): HTMLDialogElement {
  return {
    open: false,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  } as HTMLDialogElement;
}

describe('createSlidingDialogState', () => {
  test('keeps a rapid reopen when a pending close completes before sync runs', async () => {
    let open = true;
    let closedCount = 0;
    const dialogElement = createDialogElement();
    const panelElement = document.createElement('section');
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      getPanelElement: () => panelElement,
      getReducedMotion: () => false,
      getTriggerRef: () => null,
      onClosed: () => {
        closedCount += 1;
      },
    });

    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    open = false;
    dialogState.syncOpenState();
    expect(dialogState.isClosing).toBe(true);

    open = true;
    await Promise.resolve();

    expect(open).toBe(true);
    expect(dialogElement.open).toBe(true);
    expect(dialogState.renderPanel).toBe(true);
    expect(dialogState.isClosing).toBe(false);
    expect(closedCount).toBe(0);
  });

  test('calls onClosed once per close cycle, not while already closed', async () => {
    let open = false;
    let closedCount = 0;
    const dialogElement = createDialogElement();
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      getPanelElement: () => undefined,
      getReducedMotion: () => true,
      getTriggerRef: () => null,
      onClosed: () => {
        closedCount += 1;
      },
    });

    dialogState.syncOpenState();
    expect(closedCount).toBe(0);

    open = true;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    open = false;
    dialogState.syncOpenState();
    // `close()` still runs unconditionally, synchronously, right here.
    expect(dialogElement.open).toBe(false);
    expect(closedCount).toBe(0);

    // `handleClose()` — modeling the native `close` EVENT Modal wires to it
    // — is what actually triggers the deferred `onClosed` report (PR #1422
    // review, third round): `#finishClosing()` no longer reports on its
    // own, specifically so a consumer's callback never runs before THIS
    // method's own scroll-lock/escape release and focus restoration have
    // completed. Only after that does the report get scheduled, past a
    // `tick()` so it fires after Svelte would have reconciled the `{#if
    // renderPanel}` block too, not before.
    dialogState.handleClose();
    expect(closedCount).toBe(0);
    await tick();
    expect(closedCount).toBe(1);

    dialogState.syncOpenState();
    await tick();
    expect(closedCount).toBe(1);
  });

  test('a reopen BEFORE the queued native close event ever arrives leaves that event correctly stale, with no report and no undoing the reopen', async () => {
    // Regression (PR #1422 review; originally round 18, restructured for
    // the round-3 redesign): `#finishClosing()` resets `isClosing` to false
    // and calls `dialogElement.close()` SYNCHRONOUSLY, but the native
    // `close` EVENT itself — which is what now triggers the deferred
    // `onClosed` report, via `handleClose()` — is dispatched via a QUEUED
    // TASK per the WHATWG spec, arriving strictly later. If `open` flips
    // back to true (ordinary application code, not from inside `onClosed` —
    // that specific race is covered by the "STALE queued native close
    // event" test below) before that queued event ever gets a turn,
    // `syncOpenState()`'s generation bump (keyed off the dialog element's
    // own closed state, not `isClosing` alone) must invalidate the
    // in-flight close cycle — so that when the queued event eventually
    // does arrive, `handleClose()` recognizes it as stale: no cleanup, no
    // report, and no undoing the reopen that's already happened.
    let open = false;
    let closedCount = 0;
    let onOpenCount = 0;
    const dialogElement = createDialogElement();
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      // No panel element — `beginClosing()` finishes synchronously via
      // `#finishClosing()` instead of going through a real transition,
      // matching the "calls onClosed once per close cycle" test above and
      // letting this test control the exact reopen timing deterministically.
      getPanelElement: () => undefined,
      getReducedMotion: () => true,
      getTriggerRef: () => null,
      onOpen: () => {
        onOpenCount += 1;
      },
      onClosed: () => {
        closedCount += 1;
      },
    });

    open = true;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);
    expect(onOpenCount).toBe(1);

    // Close: `beginClosing()` has no panel element, so `#finishClosing()`
    // runs synchronously right here — `isClosing` is reset to false and the
    // native dialog is closed before this call returns, and this cycle's
    // generation is pushed onto the FIFO queue awaiting its own eventually-
    // arriving native `close` event.
    open = false;
    dialogState.syncOpenState();
    expect(dialogState.isClosing).toBe(false);
    expect(dialogElement.open).toBe(false);
    expect(closedCount).toBe(0);

    // Reopen BEFORE that queued event ever arrives.
    open = true;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);
    expect(dialogState.renderPanel).toBe(true);
    expect(onOpenCount).toBe(2);

    // NOW the stale queued native close event for the superseded close
    // cycle finally "lands" — simulated by calling `handleClose()` directly,
    // same as every other test in this file models the queued event.
    dialogState.handleClose();

    // The stale event must NOT have fired `onClosed`, and must NOT have
    // undone the reopen — the dialog is genuinely open again, not exited.
    expect(closedCount).toBe(0);
    expect(open).toBe(true);
    expect(dialogElement.open).toBe(true);
    expect(dialogState.renderPanel).toBe(true);

    // Nothing further fires from a subsequent tick either — there was
    // nothing scheduled at all for the stale entry.
    await tick();
    expect(closedCount).toBe(0);
  });

  test('does not fire onClosed when destroy() is called during the deferred window between handleClose() and its tick()-deferred callback', async () => {
    // Regression (PR #1422 review): `handleClose()`'s `onClosed` forwarding
    // call (via `#reportClosedOnce()`) is deferred past a `tick()`. If the
    // consumer unmounts Modal (e.g. from its own `onExitComplete`-driven
    // teardown, or simply navigating away) while that continuation is
    // still pending, the deferred closure still captured the CURRENT
    // `#closeGeneration` at schedule time — an unmount alone does not
    // change `#closeGeneration`, so the plain generation check would still
    // match and `onClosed` would fire AFTER the host component (and its
    // `onExitComplete` callback) have already been torn down. `destroy()`
    // sets a disposed flag the deferred continuation checks first,
    // unconditionally, regardless of generation.
    let open = false;
    let closedCount = 0;
    const dialogElement = createDialogElement();
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      // No panel element — `beginClosing()` finishes synchronously via
      // `#finishClosing()`, letting this test control the exact destroy
      // timing deterministically relative to the deferred `tick()`.
      getPanelElement: () => undefined,
      getReducedMotion: () => true,
      getTriggerRef: () => null,
      onClosed: () => {
        closedCount += 1;
      },
    });

    open = true;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    // Close: `#finishClosing()` runs synchronously here — the native dialog
    // is closed before this call returns.
    open = false;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(false);
    expect(closedCount).toBe(0);

    // The queued native close event arrives — `handleClose()` runs its own
    // cleanup and SCHEDULES the deferred `onClosed` report (past a
    // `tick()` that hasn't resolved yet).
    dialogState.handleClose();
    expect(closedCount).toBe(0);

    // The consumer unmounts Modal DURING that deferred window, before the
    // tick() above resolves — e.g. a parent clearing a mount flag from its
    // own (now stale) exit-complete handling, or an unrelated navigation.
    dialogState.destroy();

    await tick();

    // The deferred onClosed must NOT have fired after destroy() — the host
    // component instance is gone.
    expect(closedCount).toBe(0);
  });

  test('onClosed fires only AFTER scroll-lock/escape release and focus restoration have completed — a follow-up overlay opened from inside it keeps its own focus (PR #1422 review, cross-overlay sequencing)', async () => {
    // Regression: `#finishClosing()` used to call `#reportClosedOnce()`
    // (and therefore `onClosed`) ITSELF, before the queued native `close`
    // event ever reached `handleClose()` — so a consumer's `onClosed`
    // could open a follow-up overlay and place ITS OWN focus while this
    // Modal still owned the escape-stack/scroll-lock and had not yet
    // restored focus to its own trigger. `handleClose()`'s LATER
    // `#returnFocus()` call would then run AFTER that follow-up overlay had
    // already focused something, stealing focus back out from under it.
    // `handleClose()` is now the SOLE trigger for `onClosed` — called only
    // after its own scroll-lock/escape release and focus restoration have
    // already run — so nothing can execute afterward to interfere.
    document.body.replaceChildren();
    const triggerButton = document.createElement('button');
    triggerButton.textContent = 'Open';
    document.body.appendChild(triggerButton);
    const followUpOverlayFocusTarget = document.createElement('button');
    followUpOverlayFocusTarget.textContent = 'Follow-up overlay content';
    document.body.appendChild(followUpOverlayFocusTarget);

    let open = true;
    // A mutable object wrapper, not a bare `let`: TypeScript's control-flow
    // narrowing only sees the ONE assignment reachable through the linear
    // flow of this outer function body (the declaration's own `null`) — a
    // reassignment inside a nested closure invoked asynchronously later
    // (`onClosed`, below) isn't part of that traced flow, so a bare `let`
    // here narrows the read at the bottom of this test to the literal type
    // `null` and fails to typecheck against `triggerButton`. Wrapping in an
    // object sidesteps the narrowing entirely, since TypeScript only
    // narrows a bound identifier's OWN reassignments, never a property
    // read off it.
    const focusWhenClosedFired: { current: Element | null } = { current: null };
    const dialogElement = createDialogElement();
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      // No panel element — `beginClosing()` finishes synchronously via
      // `#finishClosing()`, letting this test control the exact timing
      // deterministically.
      getPanelElement: () => undefined,
      getReducedMotion: () => true,
      getTriggerRef: () => triggerButton,
      onClosed: () => {
        // Record focus AT THE MOMENT onClosed fires — this must already
        // reflect `handleClose()`'s own restoration (the trigger button),
        // proving cleanup and focus restoration ran BEFORE this callback,
        // never after.
        focusWhenClosedFired.current = document.activeElement;
        // Simulate a follow-up overlay opening from inside this callback
        // and placing ITS OWN focus.
        followUpOverlayFocusTarget.focus();
      },
    });

    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    open = false;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(false);

    // The queued native close event arrives: `handleClose()` runs its own
    // cleanup and focus restoration SYNCHRONOUSLY here, then merely
    // SCHEDULES the deferred `onClosed` report — which only actually runs
    // once the `await tick()` below resolves, strictly after this call has
    // already returned.
    dialogState.handleClose();

    await tick();

    expect(focusWhenClosedFired.current).toBe(triggerButton);
    // The follow-up overlay's own focus placement (from inside `onClosed`)
    // must SURVIVE — nothing runs afterward to steal it back.
    expect(document.activeElement).toBe(followUpOverlayFocusTarget);
  });

  test('a second event resolving to an ALREADY-COMPLETED generation is a complete no-op — focus is not re-stolen from a follow-up overlay (PR #1422 review, round 6)', async () => {
    // Regression: perfectly attributing provenance from a `close` event
    // alone is not possible — an external close has no queue entry of its
    // own, so `handleClose()`'s `shift()` can still consume whatever
    // happens to be at the FRONT of the queue, even an entry that belongs
    // to a completely different close than the one that actually produced
    // THIS event (e.g. a stale/duplicate event delivered late, arriving
    // AFTER an internal close has already pushed its own entry but BEFORE
    // that internal close's own real native event fires). If the
    // misattributed event's generation still happens to equal the CURRENT
    // `#closeGeneration` (nothing else has changed it), it passes
    // validation and looks like a perfectly legitimate close — cleanup
    // runs, `onClosed` fires, and a consumer opens a follow-up overlay
    // from inside it. When the GENUINE event for that same generation
    // later arrives too, it resolves to the SAME generation — and, before
    // this fix, would run `#returnFocus()` a SECOND time, stealing focus
    // back from that follow-up overlay. `#completeCloseOnce()`'s
    // per-generation guard makes completing the same generation twice a
    // hard no-op — cleanup included, not merely the `onClosed` report —
    // regardless of how the second event came to resolve to it.
    document.body.replaceChildren();
    const triggerButton = document.createElement('button');
    triggerButton.textContent = 'Open';
    document.body.appendChild(triggerButton);
    const followUpOverlayFocusTarget = document.createElement('button');
    followUpOverlayFocusTarget.textContent = 'Follow-up overlay content';
    document.body.appendChild(followUpOverlayFocusTarget);

    let open = true;
    let closedCount = 0;
    const dialogElement = createDialogElement();
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      // No panel element — `beginClosing()` finishes synchronously via
      // `#finishClosing()`, letting this test control the exact timing
      // deterministically.
      getPanelElement: () => undefined,
      getReducedMotion: () => true,
      getTriggerRef: () => triggerButton,
      onClosed: () => {
        closedCount += 1;
        // Simulate a follow-up overlay opening from inside this callback
        // and placing ITS OWN focus — same as the cross-overlay test above.
        followUpOverlayFocusTarget.focus();
      },
    });

    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    // Internal close: `#finishClosing()` runs synchronously here — pushes
    // this cycle's generation onto the queue and closes the native dialog
    // — but its OWN real native `close` event has not been simulated yet.
    open = false;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(false);
    expect(closedCount).toBe(0);

    // A MISATTRIBUTED event arrives first — modeling a stale/duplicate
    // event delivered out of band, consuming this cycle's queue entry
    // even though it isn't genuinely that entry's own native event. Since
    // nothing has changed `#closeGeneration` since the close began, this
    // still passes validation as if it were legitimate.
    dialogState.handleClose();
    await tick();
    expect(closedCount).toBe(1);
    // The follow-up overlay's focus placement from inside `onClosed` above
    // must be in place now.
    expect(document.activeElement).toBe(followUpOverlayFocusTarget);

    // NOW the GENUINE native close event for this same cycle finally
    // arrives too (the queue is empty, so it resolves via the external
    // path, to the same still-current generation). Before this fix, this
    // would run cleanup — including `#returnFocus()` — a second time.
    dialogState.handleClose();

    // A complete no-op: no second report, and — the actual bug this test
    // targets — focus must NOT have been stolen back from the follow-up
    // overlay onto `triggerButton`.
    expect(document.activeElement).toBe(followUpOverlayFocusTarget);
    await tick();
    expect(closedCount).toBe(1);
    expect(document.activeElement).toBe(followUpOverlayFocusTarget);
  });

  test('external close then reopen then internal reduced-motion close each report onClosed exactly once, per completed cycle (PR #1422 review, provenance-aware event matching)', async () => {
    // Regression: FIFO queue position ALONE cannot always attribute
    // provenance correctly across a MIXED external/internal sequence — an
    // external close (e.g. `<form method="dialog">`, or anything else
    // calling `dialogElement.close()` outside this class's own API) pushes
    // NOTHING onto `#pendingNativeCloseGenerations`, so a later internal
    // cycle's own entry must never be misread by, or misattributed to, an
    // unrelated external event. Verified here by fully completing an
    // EXTERNAL close cycle first, then a genuinely separate INTERNAL
    // (reduced-motion, synchronous) close cycle — asserting each reports
    // `onClosed` exactly once, for a total of two, never zero and never
    // three (a double-fire on either cycle).
    let open = true;
    let closedCount = 0;
    const dialogElement = createDialogElement();
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      getPanelElement: () => undefined,
      getReducedMotion: () => true,
      getTriggerRef: () => null,
      onClosed: () => {
        closedCount += 1;
      },
    });

    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    // EXTERNAL close: the browser closes the native dialog directly (e.g.
    // a `<form method="dialog">` submission), entirely bypassing
    // `requestClose()`/`beginClosing()` — `#pendingNativeCloseGenerations`
    // has NO entry for this call at all.
    dialogElement.close();
    dialogState.handleClose();
    expect(open).toBe(false);
    expect(closedCount).toBe(0);
    await tick();
    expect(closedCount).toBe(1);

    // Reopen — an entirely ordinary, unrelated open cycle.
    open = true;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    // INTERNAL close: reduced motion / no panel element, so
    // `beginClosing()` → `#finishClosing()` runs synchronously and pushes
    // ITS OWN generation onto the queue.
    open = false;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(false);
    expect(closedCount).toBe(1);

    // The queued native close event for THIS internal cycle arrives —
    // must be classified as internal (matches the pushed entry's
    // generation) and must not be confused with the earlier, already-
    // completed external cycle.
    dialogState.handleClose();
    expect(closedCount).toBe(1);
    await tick();

    // Exactly one report per cycle — two total, never a double-fire on
    // either.
    expect(closedCount).toBe(2);
    await tick();
    expect(closedCount).toBe(2);
  });

  test('a STALE external close event arriving AFTER a microtask reopen does not tear down the freshly reopened session (PR #1422 review, round 5)', async () => {
    // Regression: an external close (e.g. a `<form method="dialog">`
    // submission) has NO entry in `#pendingNativeCloseGenerations` at all —
    // round 4 treats "no entry" as sufficient to classify an event as
    // external. But a synchronous MICROTASK reopen (a consumer's
    // `onClosed` reopening the modal, or any other microtask-scheduled
    // work) can complete a full `showModal()` cycle before the BROWSER's
    // own queued TASK for that earlier external close's `close` event ever
    // gets a turn (tasks run strictly after microtasks). Before this fix,
    // that now-stale event fell through the staleness check entirely
    // (external events have `expectedGeneration === undefined`, and the
    // OLD check only ever compared a DEFINED `expectedGeneration` against
    // `#closeGeneration`) — so it tore the freshly reopened session down:
    // released its scroll lock and escape registration, called
    // `setOpen(false)` on a session the consumer just reopened, and stole
    // focus back.
    let open = true;
    let closedCount = 0;
    let reopenedFromOnClosed = false;
    const dialogElement = createDialogElement();
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      // No panel element — `beginClosing()` finishes synchronously via
      // `#finishClosing()`, letting this test control the exact timing
      // deterministically.
      getPanelElement: () => undefined,
      getReducedMotion: () => true,
      getTriggerRef: () => null,
      onClosed: () => {
        closedCount += 1;
        if (!reopenedFromOnClosed) {
          // Simulates a consumer's `onExitComplete` synchronously reopening
          // the modal from inside the callback itself — a MICROTASK
          // reopen, well before the browser's own queued TASK for the
          // external close event (below) gets a turn.
          reopenedFromOnClosed = true;
          open = true;
          dialogState.syncOpenState();
        }
      },
    });

    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    // EXTERNAL close: the browser closes the native dialog directly,
    // entirely bypassing `requestClose()`/`beginClosing()` —
    // `#pendingNativeCloseGenerations` has NO entry for this call.
    dialogElement.close();
    dialogState.handleClose();
    expect(open).toBe(false);
    expect(closedCount).toBe(0);

    // Let the deferred report fire — this is the synchronous reopen from
    // inside `onClosed` (see above). By the time this resolves, the modal
    // is genuinely open again: `open` is `true` and the native dialog is
    // `showModal()`-open again.
    await tick();
    expect(closedCount).toBe(1);
    expect(open).toBe(true);
    expect(dialogElement.open).toBe(true);
    expect(dialogState.renderPanel).toBe(true);

    // NOW the STALE external close event for the earlier, superseded close
    // finally "lands" — simulated by calling `handleClose()` again, exactly
    // modeling the browser's queued-task-fires-late race. It has no queue
    // entry either (same as the first call), so without this round's fix
    // it would be indistinguishable from a genuine current external close.
    dialogState.handleClose();

    // The fresh reopen must survive: nothing must have been undone.
    expect(open).toBe(true);
    expect(dialogElement.open).toBe(true);
    expect(dialogState.renderPanel).toBe(true);

    // No second report either — the stale event must not have scheduled
    // anything.
    await tick();
    expect(closedCount).toBe(1);
  });

  test('two rapid close→reopen→close cycles each report onClosed exactly once, not twice (PR #1422 review)', async () => {
    // Regression: a single nullable scalar (`#pendingNativeCloseGeneration`,
    // this class's original shape) can only remember the LATEST `.close()`
    // call's generation — under reduced motion / zero-duration exits,
    // close→reopen→close can cycle fast enough that a SECOND `.close()`
    // call happens before the FIRST cycle's queued native `close` event
    // ever fires. That second call's generation overwrote the first's in
    // the scalar. When the first (stale) event then arrived, it wrongly
    // compared EQUAL to the CURRENT generation (which by then reflected the
    // second cycle) — a false match — got treated as non-stale, and
    // consumed the marker. The second cycle's own (genuinely current) event
    // then arrived to find the marker already cleared, got misclassified
    // as an external native-close bypass, and fired `#reportClosedOnce()` a
    // SECOND time for a cycle `#finishClosing()` had already reported once.
    // A FIFO queue keeps each `.close()` call's generation matched to its
    // own eventually-arriving event, however many cycles overlap.
    let open = true;
    let closedCount = 0;
    const dialogElement = createDialogElement();
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      // No panel element — `beginClosing()` finishes synchronously via
      // `#finishClosing()` on every cycle, letting this test control the
      // exact close→reopen→close timing deterministically, independent of
      // `onClosed` itself — this scenario does not depend on a reopen
      // happening FROM inside `onClosed` at all; it can just as well be
      // driven by ordinary application code closing, reopening, and
      // closing again in quick succession, all before either cycle's
      // queued native event has a turn.
      getPanelElement: () => undefined,
      getReducedMotion: () => true,
      getTriggerRef: () => null,
      onClosed: () => {
        closedCount += 1;
      },
    });

    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    // Cycle 1: close. `#finishClosing()` runs synchronously here — the
    // native dialog is closed (its `.close()` call queues event 1) before
    // this call returns, but `onClosed` is only SCHEDULED, deferred past a
    // `tick()` that has not resolved yet.
    open = false;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(false);
    expect(closedCount).toBe(0);

    // Reopen, still before event 1 has fired — ordinary application code
    // flipping `open` back to `true`, not a callback-driven reopen.
    open = true;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    // Cycle 2: close again, still before event 1 has fired. `.close()` is
    // called a SECOND time here, queuing event 2 — this is exactly the
    // "second close() call before the first cycle's queued event arrives"
    // race this fix targets.
    open = false;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(false);
    expect(closedCount).toBe(0);

    // NOW both queued native `close` events land, in the FIFO order the
    // browser actually queues them: event 1 (stale, from the superseded
    // first cycle) arrives first, then event 2 (genuinely current, from
    // the second cycle).
    dialogState.handleClose(); // event 1 — must be recognized as stale and ignored.
    expect(open).toBe(false);
    expect(closedCount).toBe(0);

    dialogState.handleClose(); // event 2 — genuinely current for cycle 2.
    expect(open).toBe(false);
    expect(dialogState.renderPanel).toBe(false);

    // Only cycle 2's own deferred `#finishClosing()` report may fire, and
    // exactly once — never twice from event 2 also being misclassified as
    // an external native-close bypass.
    await tick();
    expect(closedCount).toBe(1);
    await tick();
    expect(closedCount).toBe(1);
  });

  test('a native <form method="dialog"> submission fires onClosed exactly once even though it bypasses beginClosing()/#finishClosing() (PR #1422 review, NATIVE-FORM-POLICY.md)', async () => {
    // Regression: NATIVE-FORM-POLICY.md documents `<form method="dialog">`
    // inside Modal as a supported simple accept/cancel composition. A form
    // submission with that method makes the BROWSER close the native
    // dialog directly — its own "close the dialog" steps flip
    // `dialogElement.open` to `false` SYNCHRONOUSLY and queue the `close`
    // event, entirely bypassing `requestClose()`/`beginClosing()`. Before
    // the fix, `syncOpenState()`'s subsequent reconciliation (from
    // `handleClose()`'s own `setOpen(false)`) found `dialogElement.open`
    // already `false` and only cleared `renderPanel` — `beginClosing()`
    // never ran, so `#finishClosing()` (the only other place that reported
    // exit-completion) never ran either, and `onClosed` never fired for
    // this composition at all.
    let open = true;
    let closedCount = 0;
    const dialogElement = createDialogElement();
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      getPanelElement: () => undefined,
      getReducedMotion: () => true,
      getTriggerRef: () => null,
      onClosed: () => {
        closedCount += 1;
      },
    });

    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    // Model the browser's own "close the dialog" steps for a
    // `<form method="dialog">` submission: the native dialog closes
    // directly (never via `requestClose()`), then the wired `close`-event
    // handler runs — exactly what Modal's `onclose={() =>
    // dialogState.handleClose()}` invokes for a real such event.
    dialogElement.close();
    dialogState.handleClose();

    expect(dialogState.renderPanel).toBe(false);
    expect(open).toBe(false);
    // `onClosed` is deferred past a `tick()`, same as the normal
    // exit-transition path, so the panel-gone/render-flush guarantee holds
    // for this path too.
    expect(closedCount).toBe(0);
    await tick();
    expect(closedCount).toBe(1);

    // No further ticks re-fire it.
    await tick();
    expect(closedCount).toBe(1);
  });

  test('the normal exit-transition close path still fires onClosed exactly once when the native close event ALSO arrives afterward', async () => {
    // Guards the other half of the fix: `handleClose()`'s new
    // native-close-bypass branch must NOT double-report a close that
    // already went through `beginClosing()` → `#finishClosing()`. Modal
    // wires `onclose={() => dialogState.handleClose()}` unconditionally —
    // every native `close` event reaches `handleClose()`, including the one
    // `#finishClosing()` itself triggers by calling `dialogElement.close()`.
    let open = true;
    let closedCount = 0;
    const dialogElement = createDialogElement();
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      // No panel element — `beginClosing()` finishes synchronously via
      // `#finishClosing()`, so `dialogElement.close()` (and the
      // `#pendingNativeCloseGeneration` tag) has already happened by the
      // time this test calls `handleClose()` itself, below.
      getPanelElement: () => undefined,
      getReducedMotion: () => true,
      getTriggerRef: () => null,
      onClosed: () => {
        closedCount += 1;
      },
    });

    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    open = false;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(false);

    // The native `close` event fires for this same close — modeled by
    // calling `handleClose()` directly, same as every other test in this
    // file simulates the queued native event landing.
    dialogState.handleClose();

    await tick();
    expect(closedCount).toBe(1);

    await tick();
    expect(closedCount).toBe(1);
  });

  test('an external close landing MID-TRANSITION neutralizes the in-flight #finishClosing() call — exactly one report, not two (PR #1422 review)', async () => {
    // Regression: a parent-driven close with a real panel element sets
    // `isClosing = true` and starts `waitForTransitionCompletion()` — its
    // `onComplete` (`#finishClosing(generation)`) is still PENDING while the
    // native dialog itself is still genuinely open. If a native close (a
    // `<form method="dialog">` submission, or anything else calling
    // `dialogElement.close()` outside this class's API) lands during that
    // window, `handleClose()`'s external branch used to report completion
    // (correctly, once) but left `#cancelPendingClose` and
    // `#closeGeneration` untouched. The in-flight transition callback would
    // then still eventually fire `#finishClosing(oldGeneration)`: its own
    // generation guard would NOT catch this (nothing bumped
    // `#closeGeneration`), so it would proceed, find `dialogElement.open`
    // already `false` (this external close set it), and fall into the
    // "already closed" fallback — reporting exit-completion a SECOND time
    // for a cycle already reported once.
    //
    // Round 5 review: an EARLIER version of this test called
    // `dialogState.handleClose()` SYNCHRONOUSLY, right after
    // `dialogElement.close()` — modeling the native `close` EVENT arriving
    // immediately. That masked a real ordering bug: a REAL browser
    // dispatches that event as a QUEUED TASK, which always runs strictly
    // AFTER any already-queued MICROTASK — including the in-flight
    // transition's own `queueMicrotask(finish)` completion (reduced
    // motion, below). So in a real browser, the transition callback
    // (`#finishClosing`) actually runs BEFORE `handleClose()` ever sees
    // this external close's event, not after. This version of the test
    // models that real ordering with a genuine `setTimeout` (a task) for
    // `handleClose()`, awaited only after the microtask queue has already
    // drained — exercising the FIX in `#finishClosing()`'s "already
    // closed" branch (it must NOT report directly there anymore) rather
    // than the fix in `handleClose()`'s external branch (which only
    // matters when a transition is genuinely still `isClosing` at event
    // time, not already finished by it).
    let open = true;
    let closedCount = 0;
    // Tracks whether the queued TASK (the `setTimeout` below, modeling the
    // browser's real `close` event) has actually STARTED by the time
    // `onClosed` fires — a direct, timing-robust proof of ordering. Relying
    // on `closedCount` alone here would NOT distinguish "reported
    // correctly, once, from `handleClose()`" from "reported (once)
    // PREMATURELY from `#finishClosing()`'s old fallback, with the round-4
    // `#lastReportedGeneration` guard separately suppressing the later,
    // legitimate `handleClose()`-triggered report as a same-generation
    // duplicate" — both produce `closedCount === 1` in the end, but only
    // the first is actually correct. Capturing whether the queued task had
    // already run makes the two distinguishable regardless of exactly how
    // many microtask turns either path needs to resolve.
    // An object wrapper, not a bare `let` (matches the established
    // workaround elsewhere in this codebase for the same TypeScript
    // control-flow quirk): TypeScript's control-flow narrowing only sees
    // the ONE assignment reachable through this outer function's own
    // linear flow (the declaration's `null` initializer) — a reassignment
    // inside a nested closure invoked asynchronously later (`onClosed`,
    // below) isn't part of that traced flow, so a bare `let` here narrows
    // the read at the bottom of this test to the literal type `null` and
    // fails to typecheck against `true`. A property read off a bound
    // identifier is never narrowed this way.
    const queuedTaskHadRunWhenReported: { current: boolean | null } = { current: null };
    let queuedTaskHasRun = false;
    const dialogElement = createDialogElement();
    const panelElement = document.createElement('section');
    const dialogState = createSlidingDialogState({
      getOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      getDialogElement: () => dialogElement,
      // A real panel element — `beginClosing()` takes the ASYNC
      // `waitForTransitionCompletion()` path (`isClosing = true`) instead
      // of the synchronous no-panel shortcut, so there is a genuine
      // in-flight window between the close beginning and its own
      // completion callback running. `reducedMotion: true` makes that
      // completion a queued MICROTASK (`queueMicrotask(finish)`, since no
      // CSS transition exists to wait on) rather than instant — giving this
      // test a real, if brief, window to land the external close in.
      getPanelElement: () => panelElement,
      getReducedMotion: () => true,
      getTriggerRef: () => null,
      onClosed: () => {
        closedCount += 1;
        queuedTaskHadRunWhenReported.current = queuedTaskHasRun;
      },
    });

    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);

    // Parent-driven close BEGINS the exit transition — `isClosing` is now
    // `true`, and the native dialog itself has NOT closed yet (that only
    // happens once `#finishClosing()` eventually runs).
    open = false;
    dialogState.syncOpenState();
    expect(dialogState.isClosing).toBe(true);
    expect(dialogElement.open).toBe(true);

    // A native close (e.g. a `<form method="dialog">` submission) lands
    // MID-TRANSITION: the browser's own "close the dialog" steps flip
    // `dialogElement.open` to `false` SYNCHRONOUSLY as part of handling it
    // — but the `close` EVENT itself (which invokes `handleClose()`) is
    // queued as a genuine TASK, modeled here with a real `setTimeout`
    // rather than a direct synchronous call.
    dialogElement.close();
    setTimeout(() => {
      queuedTaskHasRun = true;
      dialogState.handleClose();
    }, 0);

    // The dialog is closed, but NOTHING has processed that yet — neither
    // `handleClose()` (still queued as a task) nor the in-flight
    // transition's completion (still queued as a microtask) have run.
    expect(dialogElement.open).toBe(false);
    expect(open).toBe(false);
    expect(dialogState.isClosing).toBe(true);
    expect(closedCount).toBe(0);

    // Let BOTH the microtask queue (the in-flight transition's own
    // `queueMicrotask(finish)` completion, and — regardless of which path
    // reports — `#reportClosedOnce()`'s `tick().then(...)` continuation)
    // AND the queued task (the `setTimeout` above) resolve. A `setTimeout`
    // await always drains every pending microtask first, so by the time
    // this resolves, exactly one of the two possible reporting paths has
    // genuinely fired — proven by `queuedTaskHadRunWhenReported` below,
    // not merely by the final count.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await tick();

    // Exactly ONE report — the in-flight transition callback correctly
    // deferred to `handleClose()` instead of double-reporting itself.
    expect(closedCount).toBe(1);
    // And it must have fired ONLY after the queued task (the real native
    // `close` event) had already started running — never from
    // `#finishClosing()`'s "already closed" branch reporting prematurely,
    // during the microtask-only phase before that task ever got a turn.
    expect(queuedTaskHadRunWhenReported.current).toBe(true);
    await tick();
    expect(closedCount).toBe(1);
  });
});
