/// <reference lib="dom" />
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { compileModule } from 'svelte/compiler';

import { setupHappyDom } from '../test/happy-dom.ts';
import {
  applyAnchoredOverlayMaxBlockSize,
  getAnchoredOverlayAvailableHeightStyle,
  getAnchoredOverlayMaxBlockSizeStyle,
  getAnchoredOverlayWidthStyle,
  isAnchoredOverlayWriteCurrent,
} from './anchored-overlay.svelte.ts';

setupHappyDom();

class BoundaryResizeObserver implements ResizeObserver {
  static instances: BoundaryResizeObserver[] = [];
  readonly callback: ResizeObserverCallback;
  observed: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    BoundaryResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(target: Element): void {
    this.observed = this.observed.filter((element) => element !== target);
  }

  disconnect(): void {
    this.observed = [];
  }

  trigger(target: Element): void {
    this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

const computePositionSpy = mock(async (anchor: Element, panel: HTMLElement, options: unknown) => {
  const middleware = ((options as { middleware?: unknown[] }).middleware ?? []) as Array<{
    name?: string;
    options?: {
      apply?: (state: {
        availableHeight: number;
        elements: { floating: HTMLElement; reference: Element };
      }) => void;
      boundary?: Element;
    };
  }>;
  const sizeMiddleware = middleware.find((entry) => entry.name === 'size');
  const boundary = sizeMiddleware?.options?.boundary;
  const availableHeight = boundary?.getBoundingClientRect().height ?? 0;
  sizeMiddleware?.options?.apply?.({
    availableHeight,
    elements: { floating: panel, reference: anchor },
  });
  // Simulate Floating UI's arrow middleware having resolved a cross-axis
  // offset — real `arrow()` populates `middlewareData.arrow` internally;
  // this mock stands in for that resolution when an `arrow` middleware entry
  // is present in the request.
  const arrowRequested = middleware.some((entry) => entry.name === 'arrow');
  return {
    x: 12,
    y: 18,
    placement: 'bottom-start',
    middlewareData: arrowRequested ? { arrow: { x: 6 } } : {},
  };
});
const autoUpdateTeardown = mock(() => {});
const autoUpdateSpy = mock(
  (_anchor: Element, _panel: HTMLElement, update: () => void | Promise<void>) => {
    void update();
    return autoUpdateTeardown;
  },
);

mock.module('@floating-ui/dom', () => ({
  arrow: () => ({ name: 'arrow', fn: () => ({}) }),
  autoUpdate: autoUpdateSpy,
  computePosition: computePositionSpy,
  flip: (options: unknown) => ({ name: 'flip', options, fn: () => ({}) }),
  offset: (options: unknown) => ({ name: 'offset', options, fn: () => ({}) }),
  shift: (options: unknown) => ({ name: 'shift', options, fn: () => ({}) }),
  size: (options: unknown) => ({ name: 'size', options, fn: () => ({}) }),
}));

const { cleanup, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: AnchoredOverlayBoundaryFixture } =
  await import('../test/fixtures/anchored-overlay-boundary-fixture.svelte');

const originalResizeObserver = globalThis.ResizeObserver;

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: BoundaryResizeObserver,
    writable: true,
  });
});

beforeEach(() => {
  BoundaryResizeObserver.instances = [];
  computePositionSpy.mockClear();
  autoUpdateTeardown.mockClear();
  autoUpdateSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: originalResizeObserver,
    writable: true,
  });
});

describe('anchored overlay width styles', () => {
  test('match-anchor locks the floating surface to the anchor width', () => {
    expect(getAnchoredOverlayWidthStyle('match-anchor', { width: 144 })).toBe(
      'min-inline-size: 144px; inline-size: 144px;',
    );
  });

  test('match-anchor omits width when the anchor has no measurable width', () => {
    expect(getAnchoredOverlayWidthStyle('match-anchor', { width: 0 })).toBe('');
  });

  test('menu uses compact intrinsic sizing bounded by the viewport', () => {
    const style = getAnchoredOverlayWidthStyle('menu', { width: 320 });
    expect(style).toContain('inline-size: max-content');
    expect(style).toContain('min-inline-size: min(12rem');
    expect(style).toContain('max-inline-size: min(24rem');
  });

  test('content keeps a bounded max width without forcing intrinsic menu sizing', () => {
    expect(getAnchoredOverlayWidthStyle('content', { width: 320 })).toBe(
      'max-inline-size: min(28rem, calc(100vw - var(--cinder-space-4)));',
    );
  });

  test('none leaves width entirely to the component stylesheet', () => {
    expect(getAnchoredOverlayWidthStyle('none', { width: 320 })).toBe('');
  });

  test('available height style clamps negative space and preserves measured space', () => {
    expect(getAnchoredOverlayAvailableHeightStyle(320)).toBe('320px');
    expect(getAnchoredOverlayAvailableHeightStyle(-1)).toBe('0px');
  });

  test('applies the available-height cap during measurement and supports cleanup', () => {
    const panel = {
      style: {
        maxBlockSize: '',
        removeProperty(property: string) {
          if (property === 'max-block-size') this.maxBlockSize = '';
        },
      },
    } as unknown as HTMLElement;

    expect(getAnchoredOverlayMaxBlockSizeStyle(320, '24rem')).toBe('min(24rem, 320px)');
    expect(applyAnchoredOverlayMaxBlockSize(panel, 320, '24rem')).toBe('min(24rem, 320px)');
    expect(panel.style.maxBlockSize).toBe('min(24rem, 320px)');

    panel.style.removeProperty('max-block-size');
    expect(panel.style.maxBlockSize).toBe('');
  });

  test('rejects stale or cancelled positioning sessions before DOM writes', () => {
    expect(isAnchoredOverlayWriteCurrent(3, 3, false)).toBe(true);
    expect(isAnchoredOverlayWriteCurrent(2, 3, false)).toBe(false);
    expect(isAnchoredOverlayWriteCurrent(3, 3, true)).toBe(false);
  });

  test('server compilation omits Floating UI runtime imports', async () => {
    const sourcePath = `${import.meta.dir}/anchored-overlay.svelte.ts`;
    const source = await Bun.file(sourcePath).text();
    expect(source).toContain('sizeMiddleware({');
    expect(source).toContain('padding: shiftPadding');
    const moduleSource = new Bun.Transpiler({ loader: 'ts' }).transformSync(source);
    const result = compileModule(moduleSource, {
      filename: sourcePath,
      generate: 'server',
      dev: false,
    });

    expect(result.js.code).not.toContain('@floating-ui/dom');
  });

  test('recomputes available-height sizing when an explicit boundary changes only height', async () => {
    let boundaryHeight = 240;
    render(AnchoredOverlayBoundaryFixture);
    const boundary = screen.getByTestId('boundary');
    const panel = screen.getByTestId('panel');
    boundary.getBoundingClientRect = () =>
      ({
        width: 360,
        height: boundaryHeight,
      }) as DOMRect;

    await waitFor(() => {
      expect(computePositionSpy).toHaveBeenCalledTimes(1);
    });

    const boundaryObserver = BoundaryResizeObserver.instances.find((observer) =>
      observer.observed.includes(boundary),
    );
    expect(boundaryObserver).toBeDefined();

    boundaryHeight = 120;
    boundaryObserver?.trigger(boundary);

    await waitFor(() => {
      expect(computePositionSpy).toHaveBeenCalledTimes(2);
    });
    expect(panel.getAttribute('style')).toContain('max-block-size: min(24rem, 120px)');
  });

  test('clears available-height sizing when size turns off while open', async () => {
    const view = render(AnchoredOverlayBoundaryFixture, { size: true });
    const boundary = screen.getByTestId('boundary');
    const panel = screen.getByTestId('panel');
    boundary.getBoundingClientRect = () =>
      ({
        width: 360,
        height: 180,
      }) as DOMRect;

    await waitFor(() => {
      expect(panel.getAttribute('style')).toContain('max-block-size: min(24rem, 180px)');
    });

    await view.rerender({ size: false });

    await waitFor(() => {
      expect(computePositionSpy).toHaveBeenCalledTimes(2);
    });
    expect(panel.getAttribute('style')).not.toContain('max-block-size');
    expect(panel.style.maxBlockSize).toBe('');

    const boundaryObserver = BoundaryResizeObserver.instances.find((observer) =>
      observer.observed.includes(boundary),
    );
    boundaryObserver?.trigger(boundary);

    await waitFor(() => {
      expect(computePositionSpy).toHaveBeenCalledTimes(3);
    });
    expect(panel.getAttribute('style')).not.toContain('max-block-size');
    expect(panel.style.maxBlockSize).toBe('');
  });

  test('arrow style carries only the cross-axis offset, never a hardcoded static-side inset', async () => {
    render(AnchoredOverlayBoundaryFixture, { arrowVisible: true });
    const arrow = screen.getByTestId('arrow');

    await waitFor(() => {
      // The mock's `computePosition` resolves `middlewareData.arrow = { x: 6 }`
      // for a `bottom-start` placement — `x` is the Floating UI-computed
      // cross-axis offset, so only `left` should be written inline.
      expect(arrow.getAttribute('style')).toContain('left: 6px');
    });
    // Regression guard for the misplaced-caret defect: the static-side offset
    // (the side touching the panel — `top` for a bottom placement, `bottom`
    // for top, etc.) used to be hardcoded here as `-4px`, which beat every
    // consumer's own per-placement CSS on specificity and detached the arrow
    // from the panel edge in Popover and misshaped it in HoverCard. That
    // value must never reappear in the shared mechanism — each consumer's
    // own `[data-cinder-placement^='...']` CSS owns it instead.
    const style = arrow.getAttribute('style') ?? '';
    expect(style).not.toContain('-4px');
    expect(style).not.toContain('top:');
    expect(style).not.toContain('bottom:');
    expect(style).not.toContain('right:');
  });
});

describe('anchored overlay placement locking', () => {
  // `autoUpdate` re-runs positioning whenever the panel resizes. For a surface whose
  // height tracks its content — CommandMenu's filtered list — that means every
  // keystroke gives `flip` a fresh chance to move the panel across its anchor.
  // These tests drive that second recompute directly by replaying the callback
  // `autoUpdate` was handed, which is the same path a real resize takes.
  function replayPositioningUpdate(): Promise<void> {
    const update = autoUpdateSpy.mock.calls[0]?.[2] as (() => void | Promise<void>) | undefined;
    if (update === undefined) {
      throw new Error('autoUpdate was never called, so there is no update callback to replay');
    }
    return Promise.resolve(update());
  }

  function middlewareNames(callIndex: number): string[] {
    const options = computePositionSpy.mock.calls[callIndex]?.[2] as
      | { middleware?: Array<{ name?: string }> }
      | undefined;
    return (options?.middleware ?? []).map((entry) => entry.name ?? '');
  }

  function requestedPlacement(callIndex: number): string | undefined {
    const options = computePositionSpy.mock.calls[callIndex]?.[2] as
      | { placement?: string }
      | undefined;
    return options?.placement;
  }

  test('holds the first resolved placement across later repositions when locked', async () => {
    render(AnchoredOverlayBoundaryFixture, { lockPlacement: true });
    await waitFor(() => {
      expect(computePositionSpy.mock.calls.length).toBeGreaterThan(0);
    });

    // The opening resolve still negotiates collisions normally.
    expect(middlewareNames(0)).toContain('flip');

    await replayPositioningUpdate();
    await waitFor(() => {
      expect(computePositionSpy.mock.calls.length).toBeGreaterThan(1);
    });

    // Afterwards the resolved placement is requested outright and `flip` is dropped.
    // Both halves matter: flip would override an explicitly requested placement, so
    // passing the placement without removing flip would not actually hold anything.
    expect(requestedPlacement(1)).toBe('bottom-start');
    expect(middlewareNames(1)).not.toContain('flip');
  });

  test('holds the placement across an anchor change, not just a resize', async () => {
    // The regression this pins: the lock originally lived inside the positioning
    // effect. That effect reads options.anchor(), so it reruns whenever the anchor's
    // identity changes — and CommandMenu's anchor is a $derived over the caret, so a
    // new object arrives on every keystroke. An effect-scoped lock therefore reset on
    // each character typed, retaking the flip decision exactly as often as before and
    // leaving the menu jumping: the fix was a no-op for the interaction it targeted.
    const { rerender } = render(AnchoredOverlayBoundaryFixture, {
      lockPlacement: true,
      virtualAnchor: true,
      anchorGeneration: 0,
    });
    await waitFor(() => {
      expect(computePositionSpy.mock.calls.length).toBeGreaterThan(0);
    });
    expect(middlewareNames(0)).toContain('flip');

    // Bump the generation the way typing does — a brand new anchor object.
    await rerender({ lockPlacement: true, virtualAnchor: true, anchorGeneration: 1 });
    await waitFor(() => {
      expect(computePositionSpy.mock.calls.length).toBeGreaterThan(1);
    });

    const latest = computePositionSpy.mock.calls.length - 1;
    expect(requestedPlacement(latest)).toBe('bottom-start');
    expect(middlewareNames(latest)).not.toContain('flip');
  });

  test('keeps re-deciding placement on every reposition when not locked', async () => {
    render(AnchoredOverlayBoundaryFixture);
    await waitFor(() => {
      expect(computePositionSpy.mock.calls.length).toBeGreaterThan(0);
    });

    await replayPositioningUpdate();
    await waitFor(() => {
      expect(computePositionSpy.mock.calls.length).toBeGreaterThan(1);
    });

    // Default behaviour is unchanged for every other anchored overlay in the library.
    expect(middlewareNames(0)).toContain('flip');
    expect(middlewareNames(1)).toContain('flip');
  });

  test('still constrains the panel to the space available on the locked side', async () => {
    // Locking gives up the flip rescue, so `size` has to carry the degradation: a panel
    // that no longer fits shrinks and scrolls rather than running off the viewport.
    render(AnchoredOverlayBoundaryFixture, { lockPlacement: true, size: true });
    await waitFor(() => {
      expect(computePositionSpy.mock.calls.length).toBeGreaterThan(0);
    });

    await replayPositioningUpdate();
    await waitFor(() => {
      expect(computePositionSpy.mock.calls.length).toBeGreaterThan(1);
    });

    expect(middlewareNames(1)).toContain('size');
  });
});
