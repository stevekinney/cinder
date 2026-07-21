/**
 * Composer public API — clearInput(), getComposerValue(), insertAtRange(), oncomposerinput.
 *
 * The public `Chat` wrapper already forwarded a streaming/scroll imperative
 * API (beginStreaming/pushToken/endStreaming/scrollToBottom/scrollToTop/
 * focusInput — see chat.test.ts), but exposed no way for a consumer to read
 * the composer's current text, clear or edit it imperatively, or be notified
 * on every keystroke short of intercepting `onsubmit`. These methods support
 * in-composer slash-command palettes without reaching into
 * `.chat-input-editor` DOM directly.
 *
 * Asserts:
 *   1. getComposerValue() reflects what the user has typed.
 *   2. clearInput() empties the composer and getComposerValue() reflects it.
 *   3. insertAtRange() replaces composer text through both forwarding layers.
 *   4. oncomposerinput fires with the current value on every composer input
 *      event.
 *   5. Imperative methods are safe no-ops before mount / after
 *      unmount, matching the existing forwarded-method contract.
 */

/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
const originalResizeObserver = globalThis.ResizeObserver;
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

class TestIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
const originalIntersectionObserver = globalThis.IntersectionObserver;
globalThis.IntersectionObserver =
  TestIntersectionObserver as unknown as typeof IntersectionObserver;
afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

const { fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: Chat } = await import('./chat.svelte');
const { default: ChatContainer } = await import('./container/chat.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

type TestConversation = import('./conversation-model.ts').ConversationHistory;

let counter = 0;

function createConversation(id?: string): TestConversation {
  const now = new Date().toISOString();
  return {
    schemaVersion: 4,
    id: id ?? `composer-api-test-${++counter}`,
    status: 'active',
    metadata: {},
    ids: [],
    messages: {},
    createdAt: now,
    updatedAt: now,
  };
}

type ComposerApi = {
  clearInput: () => void;
  getComposerValue: () => string;
  getEditorElement: () => HTMLTextAreaElement | null;
  insertAtRange: (range: { start: number; end: number }, text: string) => void;
};

function mountChat(
  target: HTMLElement,
  props: Record<string, unknown> = {},
): { instance: Record<string, unknown>; api: ComposerApi } {
  const conversation = createConversation();
  const instance = mount(Chat, {
    target,
    props: { id: 'chat-composer-api', conversation, ...props },
  }) as Record<string, unknown>;
  return { instance, api: instance as unknown as ComposerApi };
}

describe('Chat — composer API', () => {
  test('getEditorElement() returns the public Chat composer textarea', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const { instance, api } = mountChat(target);

    await tick();
    const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor');

    expect(api.getEditorElement()).toBe(composer);

    unmount(instance);
    target.remove();
  });

  test('getEditorElement() returns null after public Chat unmount', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const { instance, api } = mountChat(target);

    unmount(instance);
    target.remove();

    expect(() => api.getEditorElement()).not.toThrow();
    expect(api.getEditorElement()).toBeNull();
  });

  test('getEditorElement() is forwarded by the container layer', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const conversation = createConversation();
    const instance = mount(ChatContainer, {
      target,
      props: { id: 'chat-composer-api-container', conversation },
    }) as Record<string, unknown>;
    const api = instance as unknown as ComposerApi;
    await tick();
    const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor');

    expect(api.getEditorElement()).toBe(composer);

    unmount(instance);
    target.remove();
  });

  test('getComposerValue() reflects text typed into the composer', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const { instance, api } = mountChat(target);

    const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
    await fireEvent.input(composer, { target: { value: '/help' } });

    expect(api.getComposerValue()).toBe('/help');

    unmount(instance);
    target.remove();
  });

  test('clearInput() empties the composer', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const { instance, api } = mountChat(target);

    const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
    await fireEvent.input(composer, { target: { value: 'draft to clear' } });
    expect(api.getComposerValue()).toBe('draft to clear');

    api.clearInput();
    flushSync();
    expect(api.getComposerValue()).toBe('');
    expect(composer.value).toBe('');

    unmount(instance);
    target.remove();
  });

  test('insertAtRange() writes through the public Chat wrapper', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const { instance, api } = mountChat(target);
    const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
    await fireEvent.input(composer, { target: { value: 'Ask @st about it' } });

    api.insertAtRange({ start: 4, end: 7 }, '@steve');

    expect(api.getComposerValue()).toBe('Ask @steve about it');
    expect(composer.value).toBe('Ask @steve about it');
    expect(composer.selectionStart).toBe(10);
    expect(composer.selectionEnd).toBe(10);
    expect(document.activeElement).toBe(composer);

    unmount(instance);
    target.remove();
  });

  test('insertAtRange() is forwarded by the container layer', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const conversation = createConversation();
    const instance = mount(ChatContainer, {
      target,
      props: { id: 'chat-composer-insert-container', conversation },
    }) as Record<string, unknown>;
    const api = instance as unknown as ComposerApi;
    const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
    await fireEvent.input(composer, { target: { value: '/sch tomorrow' } });

    api.insertAtRange({ start: 0, end: 4 }, '/schedule');

    expect(api.getComposerValue()).toBe('/schedule tomorrow');
    expect(composer.selectionStart).toBe(9);

    unmount(instance);
    target.remove();
  });

  test('oncomposerinput fires with the current value on every composer input event', async () => {
    const values: string[] = [];
    const target = document.createElement('div');
    document.body.append(target);
    const { instance } = mountChat(target, {
      oncomposerinput: (value: string) => values.push(value),
    });

    const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
    await fireEvent.input(composer, { target: { value: '/' } });
    await fireEvent.input(composer, { target: { value: '/sc' } });
    await fireEvent.input(composer, { target: { value: '/schedule' } });

    expect(values).toEqual(['/', '/sc', '/schedule']);

    unmount(instance);
    target.remove();
  });

  test('getComposerValue() returns an empty string before mount interaction and after unmount', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const { instance, api } = mountChat(target);

    expect(api.getComposerValue()).toBe('');

    unmount(instance);
    target.remove();

    expect(() => api.getComposerValue()).not.toThrow();
    expect(api.getComposerValue()).toBe('');
  });

  test('clearInput() is a safe no-op after unmount', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const { instance, api } = mountChat(target);

    const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
    await fireEvent.input(composer, { target: { value: 'still here' } });

    unmount(instance);
    target.remove();

    expect(() => api.clearInput()).not.toThrow();
  });

  test('insertAtRange() is a safe no-op after unmount', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const { instance, api } = mountChat(target);

    unmount(instance);
    target.remove();

    expect(() => api.insertAtRange({ start: 0, end: 0 }, 'ignored')).not.toThrow();
  });
});
