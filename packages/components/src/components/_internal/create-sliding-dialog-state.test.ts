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
});
