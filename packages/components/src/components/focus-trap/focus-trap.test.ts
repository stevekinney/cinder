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

const unfocusableInitialFocusChildren = createRawSnippet(() => ({
  render: () => `
    <div>
      <div data-testid="unfocusable-target">Unfocusable</div>
      <button data-testid="first-button">First</button>
    </div>
  `,
}));

const fallbackFocusChildren = createRawSnippet(() => ({
  // Fallback targets need an explicit `tabindex` (commonly `-1`) so they can accept programmatic
  // focus without entering the Tab order — `.focus()` is a no-op on a plain `<div>`.
  render: () => '<div data-testid="fallback-target" tabindex="-1">Fallback</div>',
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

  test('falls back when initialFocus points at an unfocusable element', async () => {
    // Regression for Bugbot finding on PR #150: `isProgrammaticallyFocusable` previously only
    // filtered hidden/disabled — a plain `<div>` or `<h2>` (no tabindex, no native focus) passed
    // the check, but `.focus()` is a no-op on it in real browsers, silently leaving focus outside
    // the trap. The check now requires a tabindex attribute, a natively focusable tag, or
    // contenteditable, so unfocusable elements fall through to tabbable descendants.
    const { getByTestId } = render(FocusTrap, {
      props: {
        initialFocus: '[data-testid="unfocusable-target"]',
        children: unfocusableInitialFocusChildren,
      },
    });

    await tick();

    expect(document.activeElement).toBe(getByTestId('first-button'));
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

  test('ignores invalid selector targets and falls back to tabbable content', async () => {
    const { getByTestId } = render(FocusTrap, {
      props: {
        initialFocus: '[',
        children: focusTrapChildren,
      },
    });

    await tick();

    expect(document.activeElement).toBe(getByTestId('first-button'));
  });

  test('restores focus to the previously focused element even if active is false at unmount', async () => {
    // Regression for Codex round 1 finding: previously the cleanup branch checked the *current*
    // `isActive()` value, so deactivating the trap before unmount silently skipped focus
    // restoration. Activation-time captured state now drives restoration on unmount regardless.
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender, unmount } = render(FocusTrap, {
      props: { active: true, children: focusTrapChildren },
    });

    await tick();
    await rerender({ active: false, children: focusTrapChildren });
    await tick();
    unmount();

    expect(document.activeElement).toBe(trigger);
  });

  test('restores focus on reactive deactivation, before unmount', async () => {
    // Regression for Codex round 2 finding: the `activated` flag alone did not handle the case
    // where `active` flipped false while the component remained mounted. The nested `$effect` now
    // runs `deactivate()` as soon as the getter returns false, restoring focus immediately.
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(FocusTrap, {
      props: { active: true, children: focusTrapChildren },
    });

    await tick();
    // While active, focus should have moved into the trap.
    expect(document.activeElement).not.toBe(trigger);

    await rerender({ active: false, children: focusTrapChildren });
    await tick();

    // Without unmounting, deactivation alone restores focus to the trigger.
    expect(document.activeElement).toBe(trigger);
  });
});
