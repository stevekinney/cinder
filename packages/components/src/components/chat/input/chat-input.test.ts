/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { mount, unmount } from 'svelte';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: ChatInput } = await import('./chat-input.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('ChatInput', () => {
  test('uses a non-empty default accessible label for blank composer labels', () => {
    const { container } = render(ChatInput, {
      id: 'blank-composer-label',
      composerLabel: '   ',
    });

    const composer = container.querySelector('textarea.chat-input-editor');
    expect(composer?.getAttribute('aria-label')).toBe('Message');
  });

  test('uses native disabled only for the disabled prop', () => {
    const { container } = render(ChatInput, {
      id: 'disabled-composer',
      disabled: true,
    });

    const composer = container.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor');
    expect(composer?.disabled).toBe(true);
    expect(composer?.readOnly).toBe(false);
  });

  test('keeps the composer read-only but focusable while sending', () => {
    const { container } = render(ChatInput, {
      id: 'sending-composer',
      sending: true,
    });

    const composer = container.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor');
    expect(composer?.disabled).toBe(false);
    expect(composer?.readOnly).toBe(true);
  });

  describe('getValue()', () => {
    test('returns the current composer text after the user types', async () => {
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, { target, props: { id: 'get-value-composer' } });
      const api = instance as unknown as { getValue: () => string };

      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: 'draft message' } });

      expect(api.getValue()).toBe('draft message');

      unmount(instance);
      target.remove();
    });

    test('reflects an empty string after clear()', async () => {
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, { target, props: { id: 'get-value-after-clear' } });
      const api = instance as unknown as { getValue: () => string; clear: () => void };

      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: 'to be cleared' } });
      expect(api.getValue()).toBe('to be cleared');

      api.clear();
      expect(api.getValue()).toBe('');

      unmount(instance);
      target.remove();
    });
  });

  describe('oncomposerinput', () => {
    test('fires with the current composer value on every input event', async () => {
      const values: string[] = [];
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, {
        target,
        props: {
          id: 'oncomposerinput-composer',
          oncomposerinput: (value: string) => values.push(value),
        },
      });

      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: '/' } });
      await fireEvent.input(composer, { target: { value: '/help' } });

      expect(values).toEqual(['/', '/help']);

      unmount(instance);
      target.remove();
    });

    test('does not throw when omitted', async () => {
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, {
        target,
        props: { id: 'oncomposerinput-omitted-composer' },
      });

      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: 'no listener' } });

      unmount(instance);
      target.remove();
    });
  });
});
