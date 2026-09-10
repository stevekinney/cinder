/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

import { _resetEscapeStack, pushEscapeHandler } from '../../_internal/overlay.ts';
import { createCommandListState } from './create-command-list-state.svelte.ts';

setupHappyDom();

function createButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = label;
  document.body.append(button);
  return button;
}

function keydown(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
}

describe('CommandListState', () => {
  afterEach(() => {
    document.body.replaceChildren();
    _resetEscapeStack();
  });

  test('registers enabled items, navigates them, and activates the selected item', () => {
    const state = createCommandListState('command-list');
    const firstButton = createButton('First');
    const secondButton = createButton('Second');
    const selected: string[] = [];

    const first = state.register(
      {
        getValue: () => 'first',
        getDisabled: () => false,
        getOnselect: () => () => selected.push('first'),
      },
      firstButton,
    );
    const second = state.register(
      {
        getValue: () => 'second',
        getDisabled: () => false,
        getOnselect: () => () => selected.push('second'),
      },
      secondButton,
    );

    expect(state.enabledIds).toEqual([first.id, second.id]);
    expect(state.activeItemId).toBe(first.id);

    const arrowDown = keydown('ArrowDown');
    expect(state.handleKeydown({ event: arrowDown })).toBe(true);
    expect(arrowDown.defaultPrevented).toBe(true);
    expect(state.activeItemId).toBe(second.id);

    expect(state.activateItemById(state.activeItemId!)).not.toBe(null);
    expect(selected).toEqual(['second']);
  });

  test('exposes context registration helpers and readiness refresh state', async () => {
    const state = createCommandListState('command-list');
    const button = createButton('Only');
    const context = state.createContext();

    const registered = context.register(
      {
        getValue: () => 'only',
        getDisabled: () => false,
        getOnselect: () => () => undefined,
      },
      button,
    );

    expect(context.listboxId).toBe('command-list');
    expect(context.activeItemId).toBe(registered.id);

    state.refreshRegistrationsReady();
    expect(state.registrationsReady).toBe(false);
    await Promise.resolve();
    expect(state.registrationsReady).toBe(true);

    registered.unregister();
    expect(state.enabledIds).toEqual([]);
  });

  test('commits listbox id changes together with registered option ids', () => {
    let listboxId = 'command-list';
    const state = createCommandListState(() => listboxId);
    const button = createButton('Only');
    const registered = state.register(
      {
        getValue: () => 'only',
        getDisabled: () => false,
        getOnselect: () => () => undefined,
      },
      button,
    );

    expect(state.listboxId).toBe('command-list');
    expect(registered.id).toBe('command-list-item-1');

    listboxId = 'renamed-list';

    expect(state.listboxId).toBe('command-list');
    expect(registered.id).toBe('command-list-item-1');

    state.syncListboxId();

    expect(state.listboxId).toBe('renamed-list');
    expect(registered.id).toBe('renamed-list-item-1');
  });

  test('syncItems preserves consumer-provided DOM ids', () => {
    let listboxId = 'command-list';
    const state = createCommandListState(() => listboxId);
    const button = createButton('Only');

    state.syncItems([
      {
        id: 'fruit-option-apple',
        node: button,
        getValue: () => 'apple',
        getDisabled: () => false,
        getOnselect: () => () => undefined,
      },
    ]);

    listboxId = 'renamed-list';
    state.syncItems([
      {
        id: 'fruit-option-apple',
        node: button,
        getValue: () => 'apple',
        getDisabled: () => false,
        getOnselect: () => () => undefined,
      },
    ]);

    expect(state.registrations[0]?.id).toBe('fruit-option-apple');
    expect(state.registrations[0]?.handle.id).toBe('fruit-option-apple');
  });

  test('autoActivateFirst: false leaves activeItemId null until explicitly navigated', () => {
    const state = createCommandListState('command-list', { autoActivateFirst: false });
    const firstButton = createButton('First');
    const secondButton = createButton('Second');

    const first = state.register(
      {
        getValue: () => 'first',
        getDisabled: () => false,
        getOnselect: () => () => undefined,
      },
      firstButton,
    );
    const second = state.register(
      {
        getValue: () => 'second',
        getDisabled: () => false,
        getOnselect: () => () => undefined,
      },
      secondButton,
    );

    // Unlike the default (autoActivateFirst: true), registering items does not
    // pre-highlight the first one.
    expect(state.activeItemId).toBeNull();

    const arrowDown = keydown('ArrowDown');
    expect(state.handleKeydown({ event: arrowDown })).toBe(true);
    expect(state.activeItemId).toBe(first.id);

    const arrowUpFromNull = keydown('ArrowUp');
    state.resetActiveItem();
    expect(state.activeItemId).toBeNull();
    expect(state.handleKeydown({ event: arrowUpFromNull })).toBe(true);
    expect(state.activeItemId).toBe(second.id);
  });

  test('bindDismissal is safe without a document', () => {
    const state = createCommandListState('command-list');
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', { configurable: true, value: undefined });

    try {
      const release = state.bindDismissal({
        isOpen: () => true,
        isInside: () => false,
        onDismiss: () => undefined,
      });
      expect(release).toBeFunction();
      release();
    } finally {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      });
    }
  });

  test('bindDismissal swallows Escape with both preventDefault and stopPropagation (CIN-428 uniform swallow-at-the-top)', () => {
    const state = createCommandListState('command-list');
    let dismissed = false;
    const release = state.bindDismissal({
      isOpen: () => true,
      isInside: () => false,
      onDismiss: () => {
        dismissed = true;
      },
    });

    try {
      const escapeEvent = keydown('Escape');
      const stopPropagationSpy = { called: false };
      const originalStopPropagation = escapeEvent.stopPropagation.bind(escapeEvent);
      escapeEvent.stopPropagation = () => {
        stopPropagationSpy.called = true;
        originalStopPropagation();
      };

      window.dispatchEvent(escapeEvent);

      expect(escapeEvent.defaultPrevented).toBe(true);
      expect(stopPropagationSpy.called).toBe(true);
      expect(dismissed).toBe(true);
    } finally {
      release();
    }
  });

  test('bindDismissal registers on the shared escape stack: with another registration underneath, only bindDismissal dismisses', () => {
    const state = createCommandListState('command-list');
    let dismissed = false;
    let parentEscapeCount = 0;
    const releaseParent = pushEscapeHandler(() => {
      parentEscapeCount += 1;
    });
    const release = state.bindDismissal({
      isOpen: () => true,
      isInside: () => false,
      onDismiss: () => {
        dismissed = true;
      },
    });

    try {
      window.dispatchEvent(keydown('Escape'));
      expect(dismissed).toBe(true);
      expect(parentEscapeCount).toBe(0);
    } finally {
      release();
      releaseParent();
    }
  });
});
