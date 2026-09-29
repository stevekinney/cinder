/// <reference lib="dom" />
/**
 * COR-521: placeholder completion and explicit editing history in
 * MarkdownEditor source mode.
 */
import type { PlaceholderCompletionConfiguration } from '@lostgradient/markdown';
import { parseMarkdownPlaceholderTokens } from '@lostgradient/markdown';
import { setupHappyDom } from '@lostgradient/testing';
import { describe, expect, mock, spyOn, test } from 'bun:test';
import { tick } from 'svelte';
import type { MarkdownEditorProps } from './markdown-editor.types.ts';
import {
  detectShortcutPlatform,
  diffSourceText,
  historyShortcut,
  SourceEditingHistory,
} from './source-editing-history.ts';
import { detectSourceTokenQuery } from './source-placeholder-completion.ts';

setupHappyDom();

const [{ default: MarkdownEditor }, { cleanup, render }] = await Promise.all([
  import('./markdown-editor.svelte'),
  import('@testing-library/svelte'),
]);

type Definitions = NonNullable<MarkdownEditorProps['placeholderDefinitions']>;

const CATALOG = {
  candidates: [
    { path: 'user.name', types: ['string'] },
    { path: 'count', types: ['integer'] },
    { path: 'enabled', types: ['boolean'] },
  ],
} satisfies Definitions;

const LISTBOX_ID = 'notes-placeholder-listbox-source';
const INSTRUCTIONS_ID = 'notes-placeholder-instructions';

type Mounted = Awaited<ReturnType<typeof mountSource>>;

async function mountSource(props: Partial<MarkdownEditorProps> = {}, id = 'notes') {
  const changes: string[] = [];
  const result = render(MarkdownEditor, {
    props: {
      id,
      label: 'Notes',
      mode: 'source',
      toolbarEnabled: false,
      value: '',
      placeholderDefinitions: CATALOG,
      onValueChange: (next: string) => changes.push(next),
      ...props,
    } as MarkdownEditorProps,
  });
  await tick();
  const textarea = result.container.querySelector('textarea.markdown-editor.source-mode');
  if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('Missing source textarea');
  textarea.focus();
  return {
    result,
    textarea,
    changes,
    component: result.component as unknown as {
      getMarkdown(): string;
      setMarkdown(content: string): void;
    },
    /**
     * Update props the way a parent that binds `value` does. The test
     * harness replaces its whole props object on rerender, so the current
     * value is passed back unless the update replaces it.
     */
    async update(next: Partial<MarkdownEditorProps>) {
      await result.rerender({ value: textarea.value, ...next } as MarkdownEditorProps);
      await tick();
    },
  };
}

async function withEditor(
  props: Partial<MarkdownEditorProps>,
  run: (editor: Mounted) => Promise<void>,
): Promise<void> {
  const editor = await mountSource(props);
  try {
    await run(editor);
  } finally {
    cleanup();
  }
}

/** Type one character at a time at the caret, the way a browser reports ordinary input. */
async function typeText(textarea: HTMLTextAreaElement, text: string): Promise<void> {
  for (const character of text) {
    textarea.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: character,
        bubbles: true,
        cancelable: true,
      }),
    );
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, start) + character + textarea.value.slice(end);
    textarea.setSelectionRange(start + character.length, start + character.length);
    textarea.dispatchEvent(
      new InputEvent('input', { inputType: 'insertText', data: character, bubbles: true }),
    );
    await tick();
  }
}

/** Move the caret without editing, as arrow keys or a click would. */
async function placeCaret(textarea: HTMLTextAreaElement, offset: number): Promise<void> {
  textarea.setSelectionRange(offset, offset);
  textarea.dispatchEvent(new Event('selectionchange', { bubbles: true }));
  await tick();
}

async function placeCaretAfter(textarea: HTMLTextAreaElement, marker: string): Promise<void> {
  const index = textarea.value.indexOf(marker);
  if (index === -1) throw new Error(`value does not contain ${marker}`);
  await placeCaret(textarea, index + marker.length);
}

function modifierFor(platform = detectShortcutPlatform()) {
  return platform.mac ? { metaKey: true } : { ctrlKey: true };
}

async function pressKey(
  textarea: HTMLTextAreaElement,
  key: string,
  init: KeyboardEventInit = {},
): Promise<KeyboardEvent> {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  textarea.dispatchEvent(event);
  textarea.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, ...init }));
  await tick();
  return event;
}

async function historyInput(
  textarea: HTMLTextAreaElement,
  inputType: 'historyUndo' | 'historyRedo',
): Promise<InputEvent> {
  const event = new InputEvent('beforeinput', { inputType, bubbles: true, cancelable: true });
  textarea.dispatchEvent(event);
  await tick();
  return event;
}

function listbox(id = LISTBOX_ID): HTMLElement | null {
  return document.getElementById(id);
}

function isOpen(id = LISTBOX_ID): boolean {
  const element = listbox(id);
  return element !== null && element.style.display !== 'none';
}

function options(id = LISTBOX_ID): HTMLElement[] {
  return [...(listbox(id)?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
}

function optionPaths(id = LISTBOX_ID): string[] {
  return options(id).map(
    (option) => option.querySelector('.template-completion-item-path')?.textContent ?? '',
  );
}

function status(container: HTMLElement): string {
  return container.querySelector('#notes-placeholder-status')?.textContent ?? '';
}

function pointer(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, { bubbles: true, cancelable: true, ...init });
}

describe('MarkdownEditor source-mode placeholder completion', () => {
  test('typing {{ opens the listbox with every catalog path', async () => {
    await withEditor({ value: 'Hello ' }, async ({ textarea }) => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);

      await typeText(textarea, '{{');

      const element = listbox();
      expect(element).not.toBeNull();
      expect(element?.getAttribute('role')).toBe('listbox');
      expect(element?.getAttribute('aria-label')).toBe('Placeholders');
      expect(isOpen()).toBe(true);
      expect(textarea.getAttribute('aria-controls')).toBe(LISTBOX_ID);
      expect(optionPaths()).toEqual(['count', 'enabled', 'user.name']);
      expect(options().map((option) => option.id)).toEqual([
        'notes-placeholder-listbox-source-count',
        'notes-placeholder-listbox-source-enabled',
        'notes-placeholder-listbox-source-user.name',
      ]);
    });
  });

  test('filters by case-insensitive prefix and announces no matches without editing', async () => {
    await withEditor({}, async ({ textarea, result, changes }) => {
      await typeText(textarea, '{{U');
      expect(optionPaths()).toEqual(['user.name']);
      expect(status(result.container)).toBe('1 placeholder available');

      await typeText(textarea, 'x');
      expect(isOpen()).toBe(false);
      expect(textarea.hasAttribute('aria-controls')).toBe(false);
      expect(textarea.hasAttribute('aria-activedescendant')).toBe(false);
      expect(status(result.container)).toBe('No matching placeholders');
      expect(textarea.value).toBe('{{Ux');
      expect(changes.at(-1)).toBe('{{Ux');
    });
  });

  test('shows metadata-only rows with every match reachable', async () => {
    const candidates = Array.from({ length: 12 }, (_, index) => ({
      path: `field${String(index).padStart(2, '0')}`,
      description: `Field ${index}`,
    }));
    await withEditor({ placeholderDefinitions: { candidates } }, async ({ textarea }) => {
      await typeText(textarea, '{{');
      expect(options()).toHaveLength(12);
      expect(options()[0]?.textContent).toBe('field00unknownField 0');
      for (let press = 0; press < 20; press += 1) await pressKey(textarea, 'ArrowDown');
      expect(textarea.getAttribute('aria-activedescendant')).toBe(`${LISTBOX_ID}-field11`);
    });
  });

  test('arrow keys move the active option with clamped ends and announce it', async () => {
    await withEditor({}, async ({ textarea, result }) => {
      await typeText(textarea, '{{');
      expect(textarea.getAttribute('aria-activedescendant')).toBe(`${LISTBOX_ID}-count`);
      expect(status(result.container)).toBe('3 placeholders available');

      const up = await pressKey(textarea, 'ArrowUp');
      expect(up.defaultPrevented).toBe(true);
      expect(textarea.getAttribute('aria-activedescendant')).toBe(`${LISTBOX_ID}-count`);

      await pressKey(textarea, 'ArrowDown');
      await pressKey(textarea, 'ArrowDown');
      await pressKey(textarea, 'ArrowDown');
      expect(textarea.getAttribute('aria-activedescendant')).toBe(`${LISTBOX_ID}-user.name`);
      expect(options().map((option) => option.getAttribute('aria-selected'))).toEqual([
        'false',
        'false',
        'true',
      ]);
      expect(status(result.container)).toBe('user.name, string, 3 of 3');
    });
  });

  test('Enter replaces the whole token with the canonical path as one change', async () => {
    await withEditor({ value: 'Hi {{US.na}} end' }, async ({ textarea, changes, result }) => {
      await placeCaretAfter(textarea, '{{US');
      expect(optionPaths()).toEqual(['user.name']);

      const enter = await pressKey(textarea, 'Enter');

      expect(enter.defaultPrevented).toBe(true);
      expect(textarea.value).toBe('Hi {{user.name}} end');
      expect(textarea.selectionStart).toBe('Hi {{user.name}}'.length);
      expect(textarea.selectionEnd).toBe('Hi {{user.name}}'.length);
      expect(changes).toEqual(['Hi {{user.name}} end']);
      expect(isOpen()).toBe(false);
      expect(status(result.container)).toBe('');
    });
  });

  test('an unclosed token never swallows prose before a later closing delimiter', async () => {
    await withEditor({ value: 'Say {{us and then }} later' }, async ({ textarea }) => {
      await placeCaretAfter(textarea, '{{us');
      await pressKey(textarea, 'Enter');
      expect(textarea.value).toBe('Say {{user.name}} and then }} later');
    });
  });

  test('a closed token with prose between the caret and the delimiter uses the unclosed range', async () => {
    await withEditor({ value: 'A {{co and more}} B' }, async ({ textarea }) => {
      await placeCaretAfter(textarea, '{{co');
      await pressKey(textarea, 'Enter');
      expect(textarea.value).toBe('A {{count}} and more}} B');
    });
  });

  test('offsets stay correct after emoji and across lines', async () => {
    await withEditor({ value: '😀 first line\n\n😀😀 x {{en}} y' }, async ({ textarea }) => {
      await placeCaretAfter(textarea, '{{e');
      expect(optionPaths()).toEqual(['enabled']);
      await pressKey(textarea, 'Enter');
      expect(textarea.value).toBe('😀 first line\n\n😀😀 x {{enabled}} y');
      expect(textarea.selectionStart).toBe('😀 first line\n\n😀😀 x {{enabled}}'.length);
    });
  });

  test('backslash-escaped paths resolve, and acceptance writes the canonical path', async () => {
    await withEditor(
      {
        value: 'A {{user\\_na}} b',
        placeholderDefinitions: { candidates: [{ path: 'user_name' }, { path: 'user' }] },
      },
      async ({ textarea }) => {
        await placeCaretAfter(textarea, 'user\\_');
        expect(optionPaths()).toEqual(['user_name']);
        await placeCaretAfter(textarea, '{{us');
        expect(optionPaths()).toEqual(['user', 'user_name']);
        await pressKey(textarea, 'ArrowDown');
        await pressKey(textarea, 'Enter');
        expect(textarea.value).toBe('A {{user_name}} b');
      },
    );
  });

  test.each([
    ['inline code', 'x `{{` y', '`{{'],
    ['a fenced code block', '```\n{{\n```\n', '```\n{{'],
    ['front matter', '---\ntitle: {{\n---\nBody', 'title: {{'],
    ['inline math', 'x $a {{ b$ y', 'a {{'],
    ['raw HTML', '<div title="{{">\n</div>\n', 'title="{{'],
    ['a link target', '[label](https://example.com/{{)', 'com/{{'],
    ['an escaped brace', 'x \\{{ y', '\\{{'],
  ])('never opens inside %s', async (_name, value, marker) => {
    await withEditor({ value }, async ({ textarea }) => {
      await placeCaretAfter(textarea, marker);
      expect(isOpen()).toBe(false);
      expect(textarea.hasAttribute('aria-controls')).toBe(false);
    });
  });

  test('link labels, list items and headings are eligible', async () => {
    await withEditor({ value: '# T {{\n\n- item {{\n\n[a {{](https://x.test)' }, async (editor) => {
      for (const marker of ['T {{', 'item {{', 'a {{']) {
        await placeCaretAfter(editor.textarea, marker);
        expect(isOpen()).toBe(true);
      }
    });
  });

  test('a non-collapsed selection never opens completion', async () => {
    await withEditor({ value: 'x {{co' }, async ({ textarea }) => {
      textarea.setSelectionRange(2, 6);
      textarea.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      await tick();
      expect(isOpen()).toBe(false);
    });
  });

  test('moving the caret out of the token closes the popup', async () => {
    await withEditor({ value: 'before {{co' }, async ({ textarea }) => {
      await placeCaret(textarea, textarea.value.length);
      expect(isOpen()).toBe(true);
      await placeCaret(textarea, 2);
      expect(isOpen()).toBe(false);
    });
  });

  test('Escape closes only the popup and a second Escape is not consumed', async () => {
    await withEditor({}, async ({ textarea, result }) => {
      const outer = mock(() => {});
      result.container.addEventListener('keydown', outer);
      await typeText(textarea, '{{');

      const first = await pressKey(textarea, 'Escape');
      expect(first.defaultPrevented).toBe(true);
      expect(outer).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
      expect(textarea.value).toBe('{{');

      const second = await pressKey(textarea, 'Escape');
      expect(second.defaultPrevented).toBe(false);
      expect(outer).toHaveBeenCalledTimes(1);

      await typeText(textarea, 'c');
      expect(optionPaths()).toEqual(['count']);
    });
  });

  test('Tab dismisses without inserting, keeps its native behavior and does not reopen', async () => {
    await withEditor({}, async ({ textarea, changes }) => {
      await typeText(textarea, '{{');
      const changeCount = changes.length;

      const tab = await pressKey(textarea, 'Tab');

      expect(tab.defaultPrevented).toBe(false);
      expect(isOpen()).toBe(false);
      expect(textarea.value).toBe('{{');
      expect(changes).toHaveLength(changeCount);
      await placeCaret(textarea, 2);
      expect(isOpen()).toBe(false);
    });
  });

  test('Home, End and Left/Right keep native editing', async () => {
    await withEditor({}, async ({ textarea }) => {
      await typeText(textarea, '{{');
      for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight']) {
        const event = await pressKey(textarea, key);
        expect(event.defaultPrevented).toBe(false);
      }
    });
  });

  test('clicking an option accepts it once and keeps focus in the textarea', async () => {
    await withEditor({ value: 'x ' }, async ({ textarea, changes }) => {
      await placeCaret(textarea, 2);
      await typeText(textarea, '{{');
      const changeCount = changes.length;
      const option = options()[1]!;

      const down = pointer('pointerdown');
      option.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await tick();

      expect(textarea.value).toBe('x {{enabled}}');
      expect(changes.slice(changeCount)).toEqual(['x {{enabled}}']);
      expect(document.activeElement).toBe(textarea);
      expect(textarea.selectionStart).toBe('x {{enabled}}'.length);
    });
  });

  test('an assistive-technology click with no pointer gesture accepts', async () => {
    await withEditor({}, async ({ textarea }) => {
      await typeText(textarea, '{{');
      options()[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await tick();
      expect(textarea.value).toBe('{{count}}');
    });
  });

  test('a pointer gesture that scrolls the list inserts nothing', async () => {
    await withEditor({}, async ({ textarea }) => {
      await typeText(textarea, '{{');
      const option = options()[0]!;
      option.dispatchEvent(pointer('pointerdown', { clientY: 10 }));
      option.dispatchEvent(pointer('pointermove', { clientY: 40 }));
      option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await tick();
      expect(textarea.value).toBe('{{');
    });
  });

  test('a pointerdown outside dismisses without preventing it', async () => {
    await withEditor({}, async ({ textarea }) => {
      await typeText(textarea, '{{');
      const outside = pointer('pointerdown');
      document.body.dispatchEvent(outside);
      await tick();
      expect(outside.defaultPrevented).toBe(false);
      expect(isOpen()).toBe(false);
      expect(textarea.value).toBe('{{');
    });
  });

  test('composition holds updates and Enter until compositionend', async () => {
    await withEditor({}, async ({ textarea, changes }) => {
      await typeText(textarea, '{{');
      textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      textarea.value = '{{c';
      textarea.setSelectionRange(3, 3);
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
      await tick();
      expect(optionPaths()).toEqual(['count', 'enabled', 'user.name']);

      const enter = await pressKey(textarea, 'Enter', { isComposing: true });
      expect(enter.defaultPrevented).toBe(false);
      expect(textarea.value).toBe('{{c');

      textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      await tick();
      expect(optionPaths()).toEqual(['count']);
      expect(changes.at(-1)).toBe('{{c');
    });
  });

  test('readonly disables completion and history interception', async () => {
    await withEditor({ value: 'x {{', readonly: true }, async ({ textarea, result }) => {
      await placeCaret(textarea, textarea.value.length);
      expect(isOpen()).toBe(false);
      expect(textarea.hasAttribute('aria-autocomplete')).toBe(false);
      expect(textarea.hasAttribute('aria-haspopup')).toBe(false);
      expect(result.container.querySelector(`#${INSTRUCTIONS_ID}`)).toBeNull();
      const undo = await pressKey(textarea, 'z', modifierFor());
      expect(undo.defaultPrevented).toBe(false);
    });
  });

  test('becoming readonly closes an open popup', async () => {
    await withEditor({}, async (editor) => {
      await typeText(editor.textarea, '{{');
      expect(isOpen()).toBe(true);
      await editor.update({ readonly: true });
      expect(isOpen()).toBe(false);
      expect(editor.textarea.hasAttribute('aria-controls')).toBe(false);
    });
  });
});

describe('MarkdownEditor source-mode editing roles', () => {
  test('the textarea carries the autocomplete relationships and merged descriptions', async () => {
    await withEditor(
      { value: 'Hi {{nope}} ', 'aria-describedby': 'caller-hint' },
      async ({ textarea, result }) => {
        expect(textarea.getAttribute('aria-multiline')).toBe('true');
        expect(textarea.getAttribute('aria-autocomplete')).toBe('list');
        expect(textarea.getAttribute('aria-haspopup')).toBe('listbox');
        expect(textarea.hasAttribute('aria-expanded')).toBe(false);
        expect(textarea.hasAttribute('aria-controls')).toBe(false);
        expect(textarea.getAttribute('aria-describedby')).toBe(
          `caller-hint ${INSTRUCTIONS_ID} notes-placeholder-diagnostics`,
        );
        expect(result.container.querySelector(`#${INSTRUCTIONS_ID}`)?.textContent).toBe(
          'Type two opening braces to insert a placeholder. Use arrow keys and Enter to choose; Escape or Tab dismisses.',
        );
        expect(
          result.container.querySelector('#notes-placeholder-diagnostics')?.textContent,
        ).toContain('nope');
        expect(
          result.container.querySelector('#notes-placeholder-status')?.getAttribute('role'),
        ).toBe('status');
      },
    );
  });

  test('without placeholder configuration the textarea has no completion attributes', async () => {
    await withEditor({ placeholderDefinitions: undefined, value: '{{' }, async ({ textarea }) => {
      await placeCaret(textarea, 2);
      expect(isOpen()).toBe(false);
      expect(textarea.hasAttribute('aria-autocomplete')).toBe(false);
      expect(textarea.hasAttribute('aria-describedby')).toBe(false);
    });
  });

  test('definitions update live without replacing the textarea or its history', async () => {
    await withEditor({}, async (editor) => {
      const { textarea, changes } = editor;
      await typeText(textarea, 'a{{');
      expect(optionPaths()).toEqual(['count', 'enabled', 'user.name']);
      const changeCount = changes.length;

      await editor.update({ placeholderDefinitions: { candidates: [{ path: 'count' }] } });
      expect(optionPaths()).toEqual(['count']);
      expect(editor.result.container.querySelector('textarea')).toBe(textarea);
      expect(changes).toHaveLength(changeCount);

      await editor.update({ placeholderDefinitions: undefined });
      expect(isOpen()).toBe(false);
      expect(textarea.hasAttribute('aria-autocomplete')).toBe(false);

      await historyInput(textarea, 'historyUndo');
      expect(textarea.value).toBe('a{');
    });
  });

  test('two editors keep separate listboxes and IDs', async () => {
    const first = await mountSource({}, 'first');
    const second = await mountSource({}, 'second');
    try {
      await typeText(first.textarea, '{{');
      await typeText(second.textarea, '{{c');
      expect(optionPaths('first-placeholder-listbox-source')).toEqual([
        'count',
        'enabled',
        'user.name',
      ]);
      expect(optionPaths('second-placeholder-listbox-source')).toEqual(['count']);
      expect(first.textarea.getAttribute('aria-controls')).toBe('first-placeholder-listbox-source');
      expect(second.textarea.getAttribute('aria-controls')).toBe(
        'second-placeholder-listbox-source',
      );
    } finally {
      cleanup();
    }
  });

  test('switching modes and unmounting remove the popup, measurement element and status', async () => {
    const editor = await mountSource();
    try {
      await typeText(editor.textarea, '{{');
      expect(isOpen()).toBe(true);
      await editor.update({ mode: 'wysiwyg' });
      expect(listbox()).toBeNull();
      expect(document.querySelector('[data-markdown-editor-caret-mirror]')).toBeNull();
      expect(status(editor.result.container)).toBe('');
    } finally {
      cleanup();
    }
    expect(listbox()).toBeNull();
  });
});

describe('MarkdownEditor source-mode history', () => {
  test('acceptance is one undo step, redo restores it, and typing afterwards is separate', async () => {
    await withEditor({}, async ({ textarea, changes }) => {
      await typeText(textarea, 'ab {{co');
      await pressKey(textarea, 'Enter');
      await typeText(textarea, '!');
      expect(textarea.value).toBe('ab {{count}}!');
      const before = changes.length;

      await historyInput(textarea, 'historyUndo');
      expect(textarea.value).toBe('ab {{count}}');
      const undo = await historyInput(textarea, 'historyUndo');
      expect(undo.defaultPrevented).toBe(true);
      expect(textarea.value).toBe('ab {{co');
      expect(textarea.selectionStart).toBe('ab {{co'.length);

      await historyInput(textarea, 'historyRedo');
      expect(textarea.value).toBe('ab {{count}}');
      expect(textarea.selectionStart).toBe('ab {{count}}'.length);
      expect(changes.slice(before)).toEqual(['ab {{count}}', 'ab {{co', 'ab {{count}}']);
    });
  });

  test('input is recorded in the capture phase, before the value binding reports it', async () => {
    // Chromium runs a microtask checkpoint between native event listeners, so
    // the bound `value` can flush before a target-phase listener registered
    // after it. History must see the input first or it mistakes typing for an
    // external replacement and clears itself (the Chromium spec covers the
    // real ordering; script-dispatched events here never interleave).
    const addEventListener = spyOn(HTMLTextAreaElement.prototype, 'addEventListener');
    try {
      await withEditor({}, async () => {
        const inputRegistrations = addEventListener.mock.calls.filter(
          ([type]) => type === 'input' || type === 'beforeinput',
        );
        const capturing = inputRegistrations.filter(([, , options]) => options === true);
        expect(capturing.map(([type]) => type).toSorted()).toEqual(['beforeinput', 'input']);
      });
    } finally {
      addEventListener.mockRestore();
    }
  });

  test('each ordinary input event is its own entry', async () => {
    await withEditor({}, async ({ textarea }) => {
      await typeText(textarea, 'abc');
      await historyInput(textarea, 'historyUndo');
      expect(textarea.value).toBe('ab');
      await historyInput(textarea, 'historyUndo');
      expect(textarea.value).toBe('a');
    });
  });

  test('the standard shortcuts replay the same history', async () => {
    await withEditor({}, async ({ textarea }) => {
      await typeText(textarea, 'ab');
      const mod = modifierFor();
      const undo = await pressKey(textarea, 'z', mod);
      expect(undo.defaultPrevented).toBe(true);
      expect(textarea.value).toBe('a');
      const redo = await pressKey(textarea, 'Z', { ...mod, shiftKey: true });
      expect(redo.defaultPrevented).toBe(true);
      expect(textarea.value).toBe('ab');
    });
  });

  test('a new edit clears redo', async () => {
    await withEditor({}, async ({ textarea }) => {
      await typeText(textarea, 'ab');
      await historyInput(textarea, 'historyUndo');
      await typeText(textarea, 'x');
      await historyInput(textarea, 'historyRedo');
      expect(textarea.value).toBe('ax');
    });
  });

  test('an external value written during composition replaces the history', async () => {
    await withEditor({ value: 'base' }, async (editor) => {
      const { textarea } = editor;
      await placeCaret(textarea, 4);
      await typeText(textarea, 'x');
      textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      await editor.update({ value: 'EXTERNAL' });
      textarea.value = 'EXTERNALか';
      textarea.setSelectionRange(9, 9);
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
      textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      await tick();
      const before = editor.changes.length;

      await historyInput(textarea, 'historyUndo');

      expect(textarea.value).toBe('EXTERNALか');
      expect(editor.changes).toHaveLength(before);
      await typeText(textarea, '!');
      await historyInput(textarea, 'historyUndo');
      expect(textarea.value).toBe('EXTERNALか');
    });
  });

  test('one complete composition is one entry', async () => {
    await withEditor({}, async ({ textarea }) => {
      await typeText(textarea, 'a');
      textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      for (const value of ['ak', 'aか', 'aかな']) {
        textarea.value = value;
        textarea.setSelectionRange(value.length, value.length);
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
      }
      textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await tick();

      await historyInput(textarea, 'historyUndo');
      expect(textarea.value).toBe('a');
      await historyInput(textarea, 'historyUndo');
      expect(textarea.value).toBe('');
    });
  });

  test('an external value replacement clears history and sets a new baseline', async () => {
    await withEditor({}, async (editor) => {
      await typeText(editor.textarea, 'ab');
      await editor.update({ value: 'replaced' });
      const before = editor.changes.length;
      await historyInput(editor.textarea, 'historyUndo');
      expect(editor.textarea.value).toBe('replaced');
      expect(editor.changes).toHaveLength(before);
      await typeText(editor.textarea, '!');
      await historyInput(editor.textarea, 'historyUndo');
      expect(editor.textarea.value).toBe('replaced');
    });
  });

  test('setMarkdown clears history', async () => {
    await withEditor({}, async ({ textarea, component }) => {
      await typeText(textarea, 'ab');
      component.setMarkdown('fresh');
      await tick();
      await historyInput(textarea, 'historyUndo');
      expect(textarea.value).toBe('fresh');
    });
  });

  test('each source mount starts a fresh history', async () => {
    await withEditor({}, async (editor) => {
      await typeText(editor.textarea, 'ab');
      await editor.update({ mode: 'wysiwyg' });
      await editor.update({ mode: 'source' });
      const textarea = editor.result.container.querySelector('textarea')!;
      const value = textarea.value;
      await historyInput(textarea, 'historyUndo');
      expect(textarea.value).toBe(value);
    });
  });
});

describe('source completion under the low-level configuration', () => {
  test('a lookup result that arrives during composition is shown after compositionend', async () => {
    const resolvers: ((candidates: { path: string }[]) => void)[] = [];
    const completion: PlaceholderCompletionConfiguration = {
      candidates: [],
      lookupDebounceMs: 0,
      lookupCandidates: () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    };
    await withEditor(
      { placeholderDefinitions: undefined, placeholderCompletion: completion },
      async ({ textarea }) => {
        await typeText(textarea, '{{a');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(resolvers).toHaveLength(1);

        textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        resolvers[0]?.([{ path: 'a.async' }]);
        await new Promise((resolve) => setTimeout(resolve, 0));
        textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        await tick();

        expect(optionPaths()).toEqual(['a.async']);
        expect(resolvers).toHaveLength(1);
      },
    );
  });

  test('a configuration change during composition aborts the pending lookup', async () => {
    const signals: AbortSignal[] = [];
    const completion: PlaceholderCompletionConfiguration = {
      candidates: [{ path: 'alpha' }],
      lookupDebounceMs: 0,
      lookupCandidates: (_query, signal) => {
        signals.push(signal);
        return new Promise(() => {});
      },
    };
    await withEditor(
      { placeholderDefinitions: undefined, placeholderCompletion: completion },
      async (editor) => {
        await typeText(editor.textarea, '{{a');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(signals).toHaveLength(1);

        editor.textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        await editor.update({
          placeholderCompletion: { candidates: [{ path: 'beta' }] },
        });
        expect(signals[0]?.aborted).toBe(true);
      },
    );
  });
});

describe('source completion building blocks', () => {
  test('detectSourceTokenQuery reads the Markdown-aware token around the caret', () => {
    const value = 'x `{{a` {{us\\_na}} y';
    const tokens = parseMarkdownPlaceholderTokens(value);
    const caret = value.indexOf('\\_') + 2;
    expect(detectSourceTokenQuery(value, { start: caret, end: caret }, tokens)).toEqual({
      query: 'us_',
      tokenFrom: value.indexOf('{{us'),
      tokenTo: value.indexOf(' y'),
      cursorPos: caret,
      marks: [],
    });
    const inCode = value.indexOf('{{a') + 3;
    expect(detectSourceTokenQuery(value, { start: inCode, end: inCode }, tokens)).toBeNull();
  });

  test('diffSourceText finds one changed range without splitting surrogate pairs', () => {
    expect(diffSourceText('abc', 'abc')).toBeNull();
    expect(diffSourceText('abc', 'abXc')).toEqual({ from: 2, removed: '', inserted: 'X' });
    expect(diffSourceText('a😀b', 'a😃b')).toEqual({ from: 1, removed: '😀', inserted: '😃' });
    expect(diffSourceText('aa', 'aaa')).toEqual({ from: 2, removed: '', inserted: 'a' });
  });

  test('SourceEditingHistory replays splices and clears itself when the text diverges', () => {
    const history = new SourceEditingHistory();
    const selection = { start: 0, end: 0 };
    history.record({
      from: 1,
      removed: 'b',
      inserted: 'XY',
      selectionBefore: selection,
      selectionAfter: { start: 3, end: 3 },
    });
    expect(history.undo('aXYc')).toEqual({ value: 'abc', selection });
    expect(history.redo('abc')).toEqual({ value: 'aXYc', selection: { start: 3, end: 3 } });
    expect(history.undo('something else')).toBeNull();
    expect(history.undoDepth).toBe(0);
    expect(history.redoDepth).toBe(0);
  });

  test('historyShortcut maps Mod-Z, Mod-Shift-Z and Windows Ctrl-Y', () => {
    const mac = { mac: true, windows: false };
    const windows = { mac: false, windows: true };
    const linux = { mac: false, windows: false };
    const key = (init: Partial<KeyboardEvent>) => ({
      key: 'z',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      ...init,
    });
    expect(historyShortcut(key({ metaKey: true }), mac)).toBe('undo');
    expect(historyShortcut(key({ ctrlKey: true }), mac)).toBeNull();
    expect(historyShortcut(key({ key: 'Z', metaKey: true, shiftKey: true }), mac)).toBe('redo');
    expect(historyShortcut(key({ ctrlKey: true }), windows)).toBe('undo');
    expect(historyShortcut(key({ key: 'y', ctrlKey: true }), windows)).toBe('redo');
    expect(historyShortcut(key({ key: 'y', ctrlKey: true }), linux)).toBeNull();
    expect(historyShortcut(key({ key: 'y', metaKey: true }), mac)).toBeNull();
    expect(historyShortcut(key({ ctrlKey: true, altKey: true }), windows)).toBeNull();
  });
});
