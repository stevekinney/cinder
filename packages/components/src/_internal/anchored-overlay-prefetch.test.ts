/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

// Isolated from anchored-overlay.test.ts on purpose: `@floating-ui/dom` dynamic imports are
// cached at the module level (both by `createAnchoredOverlay`'s own prefetch cache AND by the
// JS runtime's import cache backing `mock.module`), so a factory-invocation counter is only
// meaningful if nothing else in this test file has imported the module first. Sharing a file
// with anchored-overlay.test.ts's many `open: true` fixture renders would warm the cache before
// this test ever runs, making "was the import already in flight before `open()` became true"
// unfalsifiable.
let floatingUiFactoryCalls = 0;

const computePositionSpy = mock(async () => ({
  x: 12,
  y: 18,
  placement: 'bottom-start',
  middlewareData: {},
}));
const autoUpdateSpy = mock((_anchor: Element, _panel: HTMLElement, update: () => void) => {
  update();
  return () => {};
});

mock.module('@floating-ui/dom', () => {
  floatingUiFactoryCalls += 1;
  return {
    arrow: () => ({ name: 'arrow', fn: () => ({}) }),
    autoUpdate: autoUpdateSpy,
    computePosition: computePositionSpy,
    flip: (options: unknown) => ({ name: 'flip', options, fn: () => ({}) }),
    offset: (options: unknown) => ({ name: 'offset', options, fn: () => ({}) }),
    shift: (options: unknown) => ({ name: 'shift', options, fn: () => ({}) }),
    size: (options: unknown) => ({ name: 'size', options, fn: () => ({}) }),
  };
});

const { cleanup, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: AnchoredOverlayBoundaryFixture } =
  await import('../test/fixtures/anchored-overlay-boundary-fixture.svelte');

afterEach(() => {
  cleanup();
});

describe('anchored overlay Floating UI prefetch', () => {
  test('the @floating-ui/dom import starts as soon as the anchor/panel exist, before open() is true', async () => {
    expect(floatingUiFactoryCalls).toBe(0);

    render(AnchoredOverlayBoundaryFixture, { open: false });

    // The overlay is still closed — `computePosition` must not have run yet.
    expect(computePositionSpy).not.toHaveBeenCalled();

    // But the module import itself should already have been kicked off speculatively by the
    // mount-time prefetch effect, well before anything gates on `open()`.
    await waitFor(() => {
      expect(floatingUiFactoryCalls).toBe(1);
    });

    const panel = screen.getByTestId('panel');
    expect(panel.getAttribute('style') ?? '').not.toContain('position:');
  });

  test('opening the overlay reuses the prefetched module instead of importing it again', async () => {
    const view = render(AnchoredOverlayBoundaryFixture, { open: false });

    await waitFor(() => {
      expect(floatingUiFactoryCalls).toBe(1);
    });

    await view.rerender({ open: true });

    await waitFor(() => {
      expect(computePositionSpy).toHaveBeenCalled();
    });

    // Still exactly one factory invocation: the open-gated effect awaited the same cached
    // promise rather than starting a second `import('@floating-ui/dom')`.
    expect(floatingUiFactoryCalls).toBe(1);
  });
});
