/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

import { createAnchoredOverlayExitState } from './anchored-overlay-exit.svelte.ts';

setupHappyDom();

describe('createAnchoredOverlayExitState', () => {
  test('renders the panel immediately when open starts true', () => {
    const state = createAnchoredOverlayExitState({
      getOpen: () => true,
      getPanelElement: () => undefined,
      getReducedMotion: () => false,
    });

    expect(state.renderPanel).toBe(true);
    expect(state.isClosing).toBe(false);
  });

  test('awaits transition completion before clearing renderPanel', async () => {
    let open = true;
    let closedCount = 0;
    const panelElement = document.createElement('div');
    const state = createAnchoredOverlayExitState({
      getOpen: () => open,
      getPanelElement: () => panelElement,
      getReducedMotion: () => false,
      onClosed: () => {
        closedCount += 1;
      },
    });

    state.sync();
    expect(state.renderPanel).toBe(true);

    open = false;
    state.sync();
    expect(state.isClosing).toBe(true);
    // Still mounted while the (zero-duration, in happy-dom) transition is pending.
    expect(state.renderPanel).toBe(true);

    await Promise.resolve();

    expect(state.isClosing).toBe(false);
    expect(state.renderPanel).toBe(false);
    expect(closedCount).toBe(1);
  });

  test('a reopen during the exit transition keeps the panel mounted (generation guard)', async () => {
    let open = true;
    let closedCount = 0;
    const panelElement = document.createElement('div');
    const state = createAnchoredOverlayExitState({
      getOpen: () => open,
      getPanelElement: () => panelElement,
      getReducedMotion: () => false,
      onClosed: () => {
        closedCount += 1;
      },
    });

    state.sync();

    open = false;
    state.sync();
    expect(state.isClosing).toBe(true);

    // Reopen before the (microtask-deferred) completion callback runs.
    open = true;
    state.sync();

    expect(state.isClosing).toBe(false);
    expect(state.renderPanel).toBe(true);

    // Flush the stale completion callback from the cancelled close — it must
    // be a no-op (this is the exact defect HoverCard's hand-rolled version had).
    await Promise.resolve();

    expect(state.renderPanel).toBe(true);
    expect(state.isClosing).toBe(false);
    expect(closedCount).toBe(0);
  });

  test('reduced motion resolves without waiting for a transition event', async () => {
    let open = true;
    const panelElement = document.createElement('div');
    const state = createAnchoredOverlayExitState({
      getOpen: () => open,
      getPanelElement: () => panelElement,
      getReducedMotion: () => true,
    });

    state.sync();
    open = false;
    state.sync();
    expect(state.isClosing).toBe(true);

    await Promise.resolve();

    expect(state.isClosing).toBe(false);
    expect(state.renderPanel).toBe(false);
  });

  test('closes immediately with no panel element to await', () => {
    let open = true;
    let closedCount = 0;
    const state = createAnchoredOverlayExitState({
      getOpen: () => open,
      getPanelElement: () => undefined,
      getReducedMotion: () => false,
      onClosed: () => {
        closedCount += 1;
      },
    });

    state.sync();
    open = false;
    state.sync();

    expect(state.isClosing).toBe(false);
    expect(state.renderPanel).toBe(false);
    expect(closedCount).toBe(1);
  });
});
