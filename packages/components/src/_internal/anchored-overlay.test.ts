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
  return { x: 12, y: 18, placement: 'bottom-start', middlewareData: {} };
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
});
