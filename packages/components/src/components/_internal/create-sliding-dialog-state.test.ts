/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

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
  test('calls onClosed once per close cycle, not while already closed', () => {
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
    expect(closedCount).toBe(1);
    expect(dialogElement.open).toBe(false);

    dialogState.syncOpenState();
    expect(closedCount).toBe(1);
  });
});
