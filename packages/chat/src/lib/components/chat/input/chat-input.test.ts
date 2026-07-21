/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { mount, tick, unmount } from 'svelte';
import { compile } from 'svelte/compiler';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: ChatInput } = await import('./chat-input.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

test('server compilation does not retain lifecycle hooks from the external Svelte runtime', async () => {
  const sourcePath = resolve(import.meta.dir, 'chat-input.svelte');
  const source = await Bun.file(sourcePath).text();
  const serverCode = compile(source, {
    filename: sourcePath,
    generate: 'server',
    runes: true,
  }).js.code;
  const clientCode = compile(source, {
    filename: sourcePath,
    generate: 'client',
    runes: true,
  }).js.code;
  const actionRegistrationMarker = '$.action(';

  expect(clientCode).toContain(actionRegistrationMarker);
  expect(serverCode).not.toContain(actionRegistrationMarker);
  expect(serverCode).not.toContain('onDestroy');
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

  describe('insertAtRange()', () => {
    test('replaces the range, synchronizes the value, and focuses the caret after the text', async () => {
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, { target, props: { id: 'insert-at-range-composer' } });
      const api = instance as unknown as {
        getValue: () => string;
        insertAtRange: (range: { start: number; end: number }, text: string) => void;
      };
      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: 'Run /hel now' } });

      api.insertAtRange({ start: 4, end: 8 }, '/help');

      expect(api.getValue()).toBe('Run /help now');
      expect(composer.value).toBe('Run /help now');
      expect(composer.selectionStart).toBe(9);
      expect(composer.selectionEnd).toBe(9);
      expect(document.activeElement).toBe(composer);

      unmount(instance);
      target.remove();
    });

    test('uses native textarea range validation and clamping', async () => {
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, { target, props: { id: 'insert-range-boundaries' } });
      const api = instance as unknown as {
        getValue: () => string;
        insertAtRange: (range: { start: number; end: number }, text: string) => void;
      };
      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: 'hello' } });

      api.insertAtRange({ start: 5, end: 500 }, '!');
      expect(api.getValue()).toBe('hello!');
      expect(composer.selectionStart).toBe(6);
      expect(composer.selectionEnd).toBe(6);

      api.insertAtRange({ start: Number.NaN, end: Number.NaN }, '>');
      expect(api.getValue()).toBe('>hello!');
      expect(composer.selectionStart).toBe(1);
      expect(composer.selectionEnd).toBe(1);

      api.insertAtRange({ start: -1, end: -1 }, '<');
      expect(api.getValue()).toBe('>hello!<');
      expect(composer.selectionStart).toBe(8);
      expect(composer.selectionEnd).toBe(8);

      let rangeError: unknown;
      try {
        api.insertAtRange({ start: 4, end: 2 }, '?');
      } catch (error) {
        rangeError = error;
      }
      expect(rangeError).toBeDefined();
      expect((rangeError as Error).constructor.name).toBe('DOMException');
      expect(api.getValue()).toBe('>hello!<');

      unmount(instance);
      target.remove();
    });

    test('preserves native caret placement when inserted text is normalized', async () => {
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, { target, props: { id: 'insert-normalized-text' } });
      const api = instance as unknown as {
        getValue: () => string;
        insertAtRange: (range: { start: number; end: number }, text: string) => void;
      };
      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: 'ab' } });
      const setRangeText = composer.setRangeText.bind(composer);
      composer.setRangeText = (
        replacement: string,
        start?: number,
        end?: number,
        selectionMode?: SelectionMode,
      ): void => {
        const normalizedReplacement = replacement.replaceAll('\r\n', '\n');
        if (start === undefined || end === undefined) {
          setRangeText(normalizedReplacement);
          return;
        }
        setRangeText(normalizedReplacement, start, end, selectionMode);
      };

      api.insertAtRange({ start: 1, end: 1 }, '\r\n');

      expect(api.getValue()).toBe('a\nb');
      expect(composer.selectionStart).toBe(2);
      expect(composer.selectionEnd).toBe(2);

      unmount(instance);
      target.remove();
    });

    test('notifies composer observers with the updated value without a synthetic event', async () => {
      const changes: Array<{ value: string; event: Event | undefined }> = [];
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, {
        target,
        props: {
          id: 'insert-range-observer',
          oncomposerinput: (value: string, event?: Event) => changes.push({ value, event }),
        },
      });
      const api = instance as unknown as {
        insertAtRange: (range: { start: number; end: number }, text: string) => void;
      };
      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: '/he' } });
      changes.length = 0;

      api.insertAtRange({ start: 0, end: 3 }, '/help ');

      expect(changes).toEqual([{ value: '/help ', event: undefined }]);

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

    test('does not call the consumer hook during IME composition', async () => {
      let keydownCount = 0;
      let submitCount = 0;
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, {
        target,
        props: {
          id: 'composer-keydown-ime-hook',
          oncomposerkeydown: (event: KeyboardEvent) => {
            keydownCount += 1;
            event.preventDefault();
          },
          onsubmit: () => {
            submitCount += 1;
          },
        },
      });

      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.input(composer, { target: { value: 'かな' } });
      await fireEvent.compositionStart(composer);
      await fireEvent.keyDown(composer, { key: 'Enter', isComposing: true });

      expect(keydownCount).toBe(0);
      expect(submitCount).toBe(0);

      unmount(instance);
      target.remove();
    });
  });

  describe('composer overlay caret hooks', () => {
    test('fires oncomposerselectionchange for pointer and selection activity', async () => {
      const events: string[] = [];
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, {
        target,
        props: {
          id: 'composer-selection-change',
          oncomposerselectionchange: (event: Event) => events.push(event.type),
        },
      });

      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.pointerUp(composer);
      await fireEvent.select(composer);

      expect(events).toEqual(['pointerup', 'select']);

      unmount(instance);
      target.remove();
    });

    test('fires oncomposerblur when focus leaves the composer', async () => {
      const events: string[] = [];
      const target = document.createElement('div');
      document.body.append(target);
      const instance = mount(ChatInput, {
        target,
        props: {
          id: 'composer-blur',
          oncomposerblur: (event: FocusEvent) => events.push(event.type),
        },
      });

      const composer = target.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor')!;
      await fireEvent.blur(composer);

      expect(events).toEqual(['blur']);

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
