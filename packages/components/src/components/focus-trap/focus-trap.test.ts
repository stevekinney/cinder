/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: FocusTrap } = await import('./focus-trap.svelte');

const focusTrapChildren = createRawSnippet(() => ({
  render: () => `
    <div>
      <button data-testid="first-button">First</button>
      <button data-testid="last-button">Last</button>
    </div>
  `,
}));

const initialFocusChildren = createRawSnippet(() => ({
  render: () => `
    <div>
      <button data-testid="first-button">First</button>
      <button data-testid="initial-button">Initial</button>
    </div>
  `,
}));

const fallbackFocusChildren = createRawSnippet(() => ({
  render: () => '<div data-testid="fallback-target">Fallback</div>',
}));

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('FocusTrap', () => {
  test('wraps Tab from the last element to the first', async () => {
    const { getByTestId } = render(FocusTrap, {
      props: { children: focusTrapChildren },
    });

    const first = getByTestId('first-button') as HTMLButtonElement;
    const last = getByTestId('last-button') as HTMLButtonElement;
    await tick();
    last.focus();

    await fireEvent.keyDown(last, { key: 'Tab' });

    expect(document.activeElement).toBe(first);
  });

  test('wraps Shift+Tab from the first element to the last', async () => {
    const { getByTestId } = render(FocusTrap, {
      props: { children: focusTrapChildren },
    });

    const first = getByTestId('first-button') as HTMLButtonElement;
    const last = getByTestId('last-button') as HTMLButtonElement;
    await tick();
    first.focus();

    await fireEvent.keyDown(first, { key: 'Tab', shiftKey: true, bubbles: true });

    expect(document.activeElement).toBe(last);
  });

  test('restores focus to the previously focused element on teardown', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(FocusTrap, {
      props: { children: focusTrapChildren },
    });

    await tick();
    unmount();

    expect(document.activeElement).toBe(trigger);
  });

  test('focuses the requested initial focus target on mount', async () => {
    const { getByTestId } = render(FocusTrap, {
      props: {
        initialFocus: '[data-testid="initial-button"]',
        children: initialFocusChildren,
      },
    });

    await tick();

    expect(document.activeElement).toBe(getByTestId('initial-button'));
  });

  test('uses fallbackFocus when no tabbable descendants exist', async () => {
    const { getByTestId } = render(FocusTrap, {
      props: {
        fallbackFocus: '[data-testid="fallback-target"]',
        children: fallbackFocusChildren,
      },
    });

    await tick();

    expect(document.activeElement).toBe(getByTestId('fallback-target'));
  });
});
