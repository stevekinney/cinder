/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

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
});
