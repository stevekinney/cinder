/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: ClickAwayListener } = await import('./click-away-listener.svelte');

const simpleChildren = createRawSnippet(() => ({
  render: () => '<button data-testid="inside-button">Inside</button>',
}));

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('ClickAwayListener', () => {
  test('renders children inside a wrapping div', () => {
    const { getByTestId } = render(ClickAwayListener, {
      props: { onClickAway: () => {}, children: simpleChildren },
    });
    expect(getByTestId('inside-button')).not.toBeNull();
  });

  test('applies a custom class to the root element', () => {
    const { container } = render(ClickAwayListener, {
      props: { onClickAway: () => {}, class: 'my-wrapper', children: simpleChildren },
    });
    expect(container.querySelector('.my-wrapper')).not.toBeNull();
  });

  test('spreads rest props onto the root div', () => {
    const { container } = render(ClickAwayListener, {
      props: {
        onClickAway: () => {},
        'data-testid': 'root-div',
        children: simpleChildren,
      },
    });
    expect(container.querySelector('[data-testid="root-div"]')).not.toBeNull();
  });

  test('does not call onClickAway when clicking inside the component', async () => {
    let callCount = 0;
    const { getByTestId } = render(ClickAwayListener, {
      props: {
        onClickAway: () => {
          callCount += 1;
        },
        children: simpleChildren,
      },
    });

    await tick();
    const button = getByTestId('inside-button');
    await fireEvent.pointerDown(button);

    expect(callCount).toBe(0);
  });

  test('calls onClickAway when clicking outside the component', async () => {
    let callCount = 0;
    render(ClickAwayListener, {
      props: {
        onClickAway: () => {
          callCount += 1;
        },
        children: simpleChildren,
      },
    });

    await tick();

    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Outside';
    document.body.appendChild(outsideButton);

    await fireEvent.pointerDown(outsideButton);

    expect(callCount).toBe(1);
  });

  test('passes the event to onClickAway', async () => {
    let receivedEvent: PointerEvent | MouseEvent | TouchEvent | null = null;
    render(ClickAwayListener, {
      props: {
        onClickAway: (event: PointerEvent | MouseEvent | TouchEvent) => {
          receivedEvent = event;
        },
        children: simpleChildren,
      },
    });

    await tick();

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    await fireEvent.pointerDown(outsideElement);

    expect(receivedEvent).not.toBeNull();
  });

  test('does not call onClickAway when enabled is false', async () => {
    let callCount = 0;
    render(ClickAwayListener, {
      props: {
        onClickAway: () => {
          callCount += 1;
        },
        enabled: false,
        children: simpleChildren,
      },
    });

    await tick();

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    await fireEvent.pointerDown(outsideElement);

    expect(callCount).toBe(0);
  });

  test('stops calling onClickAway after enabled flips to false', async () => {
    let callCount = 0;

    const { rerender } = render(ClickAwayListener, {
      props: {
        onClickAway: () => {
          callCount += 1;
        },
        enabled: true,
        children: simpleChildren,
      },
    });

    await tick();

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    await fireEvent.pointerDown(outsideElement);
    expect(callCount).toBe(1);

    await rerender({
      onClickAway: () => {
        callCount += 1;
      },
      enabled: false,
      children: simpleChildren,
    });
    await tick();

    await fireEvent.pointerDown(outsideElement);
    expect(callCount).toBe(1);
  });

  test('resumes calling onClickAway after enabled flips back to true', async () => {
    let callCount = 0;

    const onClickAway = () => {
      callCount += 1;
    };

    const { rerender } = render(ClickAwayListener, {
      props: { onClickAway, enabled: false, children: simpleChildren },
    });

    await tick();

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    await fireEvent.pointerDown(outsideElement);
    expect(callCount).toBe(0);

    await rerender({ onClickAway, enabled: true, children: simpleChildren });
    await tick();

    await fireEvent.pointerDown(outsideElement);
    expect(callCount).toBe(1);
  });

  test('stops listening after unmount', async () => {
    let callCount = 0;

    const { unmount } = render(ClickAwayListener, {
      props: {
        onClickAway: () => {
          callCount += 1;
        },
        children: simpleChildren,
      },
    });

    await tick();
    unmount();

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    await fireEvent.pointerDown(outsideElement);

    expect(callCount).toBe(0);
  });
});

describe('ClickAwayListener — TouchEvent-undefined regression', () => {
  // Simulate a browser where window.PointerEvent is absent AND TouchEvent is also
  // absent (e.g. legacy desktop Safari / jsdom). In that environment the component
  // uses the mousedown+touchstart fallback path, and the old code would crash
  // every mousedown with `TypeError: Right-hand side of 'instanceof' is not an
  // object` because it referenced the TouchEvent global unguarded.
  // Use bracket access via unknown-cast to satisfy TS4111 / no-index-signature rules.
  const g = globalThis as unknown as Record<string, unknown>;
  // The component reads `window.PointerEvent` where `window` is the happy-dom
  // Window object installed on globalThis. We need to shadow it there.
  const win = (g['window'] ?? g) as Record<string, unknown>;

  // Save originals before any override so afterEach can restore exactly.
  const originalPointerEventWin = win['PointerEvent'];
  const originalPointerEventG = g['PointerEvent'];
  const originalTouchEventG = g['TouchEvent'];

  beforeEach(() => {
    // Override PointerEvent on both globalThis and the window object to force
    // the mousedown+touchstart fallback path.
    Object.defineProperty(win, 'PointerEvent', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(g, 'PointerEvent', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(g, 'TouchEvent', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    // Restore the saved originals so that later test files see the real globals.
    // Simple `delete` is not sufficient here because we installed own-properties
    // via Object.defineProperty on globalThis itself (not on a prototype), so
    // deleting the own-property leaves the name unresolvable in subsequent files.
    Object.defineProperty(win, 'PointerEvent', {
      value: originalPointerEventWin,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(g, 'PointerEvent', {
      value: originalPointerEventG,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(g, 'TouchEvent', {
      value: originalTouchEventG,
      configurable: true,
      writable: true,
    });
    cleanup();
    document.body.replaceChildren();
  });

  test('fires onClickAway for outside mousedown when PointerEvent and TouchEvent are absent', async () => {
    let callCount = 0;
    let thrownError: unknown = null;

    render(ClickAwayListener, {
      props: {
        onClickAway: () => {
          callCount += 1;
        },
        children: simpleChildren,
      },
    });

    await tick();

    const outsideElement = document.createElement('button');
    document.body.appendChild(outsideElement);

    try {
      await fireEvent.mouseDown(outsideElement);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeNull();
    expect(callCount).toBe(1);
  });

  test('does not throw and does not fire onClickAway for inside mousedown when PointerEvent and TouchEvent are absent', async () => {
    let callCount = 0;
    let thrownError: unknown = null;

    const { getByTestId } = render(ClickAwayListener, {
      props: {
        onClickAway: () => {
          callCount += 1;
        },
        children: simpleChildren,
      },
    });

    await tick();

    const insideButton = getByTestId('inside-button');

    try {
      await fireEvent.mouseDown(insideButton);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeNull();
    expect(callCount).toBe(0);
  });
});
