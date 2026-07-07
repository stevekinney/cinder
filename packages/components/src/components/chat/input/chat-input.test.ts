/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { mount, tick, unmount } from 'svelte';

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

  describe('getEditorElement()', () => {
    test('returns the rendered composer textarea', async () => {
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, { target, props: { id: 'get-editor-element-composer' } });
      const api = instance as unknown as { getEditorElement: () => HTMLTextAreaElement | null };

      await tick();
      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor');

      expect(api.getEditorElement()).toBe(composer);

      unmount(instance);
      target.remove();
    });

    test('returns null after unmount', () => {
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, { target, props: { id: 'get-editor-element-unmount' } });
      const api = instance as unknown as { getEditorElement: () => HTMLTextAreaElement | null };

      unmount(instance);
      target.remove();

      expect(api.getEditorElement()).toBeNull();
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

  describe('oncomposerkeydown', () => {
    test('fires before Enter-to-send internal handling', async () => {
      const calls: string[] = [];
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, {
        target,
        props: {
          id: 'composer-keydown-order',
          oncomposerkeydown: () => calls.push('keydown'),
          onsubmit: () => calls.push('submit'),
        },
      });

      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: 'send this' } });
      await fireEvent.keyDown(composer, { key: 'Enter' });

      expect(calls).toEqual(['keydown', 'submit']);

      unmount(instance);
      target.remove();
    });

    test('skips Enter-to-send when the consumer prevents default', async () => {
      let submitCount = 0;
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, {
        target,
        props: {
          id: 'composer-keydown-prevent-default',
          oncomposerkeydown: (event: KeyboardEvent) => event.preventDefault(),
          onsubmit: () => {
            submitCount += 1;
          },
        },
      });

      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: 'overlay choice' } });
      await fireEvent.keyDown(composer, { key: 'Enter' });

      expect(submitCount).toBe(0);

      unmount(instance);
      target.remove();
    });

    test('keeps Enter-to-send working when the hook is omitted', async () => {
      let submitCount = 0;
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, {
        target,
        props: {
          id: 'composer-keydown-omitted',
          onsubmit: () => {
            submitCount += 1;
          },
        },
      });

      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: 'plain send' } });
      await fireEvent.keyDown(composer, { key: 'Enter' });

      expect(submitCount).toBe(1);

      unmount(instance);
      target.remove();
    });

    test('does not submit Enter while IME composition is active', async () => {
      let submitCount = 0;
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, {
        target,
        props: {
          id: 'composer-keydown-ime',
          onsubmit: () => {
            submitCount += 1;
          },
        },
      });

      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: 'かな' } });
      await fireEvent.compositionStart(composer);
      await fireEvent.keyDown(composer, { key: 'Enter', isComposing: true });

      expect(submitCount).toBe(0);

      unmount(instance);
      target.remove();
    });
  });

  describe('composer ARIA pass-through', () => {
    test('renders overlay ARIA attributes on the composer textarea', () => {
      const { container } = render(ChatInput, {
        id: 'composer-aria',
        composerRole: 'combobox',
        composerAriaExpanded: 'true',
        composerAriaControls: 'slash-command-listbox',
        composerAriaActiveDescendant: 'slash-command-option-2',
        composerAriaAutocomplete: 'list',
      });

      const composer = container.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor');

      expect(composer?.getAttribute('role')).toBe('combobox');
      expect(composer?.getAttribute('aria-expanded')).toBe('true');
      expect(composer?.getAttribute('aria-controls')).toBe('slash-command-listbox');
      expect(composer?.getAttribute('aria-activedescendant')).toBe('slash-command-option-2');
      expect(composer?.getAttribute('aria-autocomplete')).toBe('list');
    });

    test('updates overlay ARIA attributes reactively', async () => {
      const view = render(ChatInput, {
        id: 'composer-aria-reactive',
        composerRole: 'combobox',
        composerAriaExpanded: 'false',
        composerAriaControls: 'slash-command-listbox',
        composerAriaActiveDescendant: undefined,
        composerAriaAutocomplete: 'list',
      });
      const composer = view.container.querySelector<HTMLTextAreaElement>(
        'textarea.chat-input-editor',
      );

      await view.rerender({
        id: 'composer-aria-reactive',
        composerRole: 'combobox',
        composerAriaExpanded: 'true',
        composerAriaControls: 'slash-command-listbox',
        composerAriaActiveDescendant: 'slash-command-option-1',
        composerAriaAutocomplete: 'both',
      });

      expect(composer?.getAttribute('aria-expanded')).toBe('true');
      expect(composer?.getAttribute('aria-activedescendant')).toBe('slash-command-option-1');
      expect(composer?.getAttribute('aria-autocomplete')).toBe('both');
    });
  });
});
