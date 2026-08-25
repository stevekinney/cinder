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
    // `close()` still runs unconditionally, synchronously, right here —
    // only the `onClosed` forwarding call is deferred past a `tick()` so it
    // fires after Svelte would have reconciled the `{#if renderPanel}`
    // block, not before.
    expect(dialogElement.open).toBe(false);
    expect(closedCount).toBe(0);
    await tick();
    expect(closedCount).toBe(1);

    dialogState.syncOpenState();
    await tick();
    expect(closedCount).toBe(1);
  });

  test('does not fire onClosed when reopened during the deferred window between #finishClosing and its tick()-deferred callback', async () => {
    // Regression (PR #1422 review, round 18): `#finishClosing()` resets
    // `isClosing` to false and calls `dialogElement.close()` SYNCHRONOUSLY,
    // but defers its `onClosed` forwarding call past a `tick()`. If `open`
    // flips back to true during that deferred window — after `isClosing` is
    // already false and the dialog is already closed, but before the tick's
    // flush lands — `syncOpenState()`'s old generation-bump logic (gated on
    // `isClosing` alone) never ran, so the stale deferred callback would
    // still fire `onClosed`, signaling "exit complete" for a Modal that is
    // actually freshly open again.
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
    // native dialog is closed before this call returns, but `onClosed` is
    // only scheduled (deferred past a `tick()` that hasn't resolved yet).
    open = false;
    dialogState.syncOpenState();
    expect(dialogState.isClosing).toBe(false);
    expect(dialogElement.open).toBe(false);
    expect(closedCount).toBe(0);

    // Reopen DURING the deferred window, before the tick() above resolves.
    open = true;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(true);
    expect(dialogState.renderPanel).toBe(true);
    expect(onOpenCount).toBe(2);

    // Let the original close cycle's deferred callback settle.
    await tick();

    // The stale onClosed must NOT have fired — the dialog is genuinely open
    // again, not exited.
    expect(closedCount).toBe(0);
    expect(dialogElement.open).toBe(true);
    expect(dialogState.renderPanel).toBe(true);
  });

  test('does not fire onClosed when destroy() is called during the deferred window between #finishClosing and its tick()-deferred callback', async () => {
    // Regression (PR #1422 review): `#finishClosing()`'s `onClosed`
    // forwarding call is deferred past a `tick()`. If the consumer unmounts
    // Modal (e.g. from its own `onExitComplete`-driven teardown, or simply
    // navigating away) while that continuation is still pending, the
    // deferred closure still captured the CURRENT `#closeGeneration` at
    // schedule time — an unmount alone does not change `#closeGeneration`,
    // so the plain generation check would still match and `onClosed` would
    // fire AFTER the host component (and its `onExitComplete` callback)
    // have already been torn down. `destroy()` now sets a disposed flag the
    // deferred continuation checks first, unconditionally, regardless of
    // generation.
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
    // is closed before this call returns, but `onClosed` is only scheduled
    // (deferred past a `tick()` that hasn't resolved yet).
    open = false;
    dialogState.syncOpenState();
    expect(dialogElement.open).toBe(false);
    expect(closedCount).toBe(0);

    // The consumer unmounts Modal DURING the deferred window, before the
    // tick() above resolves — e.g. a parent clearing a mount flag from its
    // own (now stale) exit-complete handling, or an unrelated navigation.
    dialogState.destroy();

    await tick();

    // The deferred onClosed must NOT have fired after destroy() — the host
    // component instance is gone.
    expect(closedCount).toBe(0);
  });
});
