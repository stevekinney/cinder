/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { TerminalFrameDimensions } from './terminal-frame.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: TerminalFrame } = await import('./terminal-frame.svelte');

afterEach(cleanup);

const children = createRawSnippet(() => ({ render: () => '<div data-testid="pty"></div>' }));

describe('TerminalFrame', () => {
  test('renders chrome, status, consumer terminal content, and reload recovery', async () => {
    let reloads = 0;
    const { container, getByRole } = render(TerminalFrame, {
      props: {
        title: 'Build shell',
        status: 'error',
        error: 'Connection lost',
        onReloadRequest: () => reloads++,
        children,
      },
    });

    expect(container.querySelector('.cinder-terminal-frame__title')?.textContent).toBe(
      'Build shell',
    );
    expect(container.querySelector('.cinder-terminal-frame__status')?.textContent).toBe('error');
    expect(container.querySelector('[data-cinder-status="error"]')).not.toBeNull();
    expect(container.querySelector('[data-status]')).toBeNull();
    expect(container.querySelector('[data-testid="pty"]')).not.toBeNull();
    expect(getByRole('region', { name: 'Build shell' })).not.toBeNull();
    expect(getByRole('alert').textContent).toContain('Connection lost');
    await fireEvent.click(getByRole('button', { name: 'Reload' }));
    expect(reloads).toBe(1);
  });

  test('reports deduplicated character-cell dimensions from ResizeObserver', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    let callback: ResizeObserverCallback | undefined;
    globalThis.ResizeObserver = class {
      constructor(nextCallback: ResizeObserverCallback) {
        callback = nextCallback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;

    try {
      const dimensions: Array<{ cols: number; rows: number }> = [];
      render(TerminalFrame, {
        props: {
          title: 'Shell',
          columnWidth: 10,
          rowHeight: 20,
          onDimensionsChange: (value: TerminalFrameDimensions) => {
            dimensions.push(value);
          },
          children,
        },
      });

      const entry = { contentRect: { width: 805, height: 405 } } as ResizeObserverEntry;
      callback?.([entry], {} as ResizeObserver);
      callback?.([entry], {} as ResizeObserver);
      expect(dimensions).toEqual([{ cols: 80, rows: 20 }]);
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test('ignores invalid character-cell dimensions', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    let observations = 0;
    globalThis.ResizeObserver = class {
      observe() {
        observations++;
      }
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;

    try {
      render(TerminalFrame, {
        props: { title: 'Shell', columnWidth: 0, rowHeight: Number.NaN, children },
      });
      expect(observations).toBe(0);
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });
});
