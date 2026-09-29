/**
 * COR-526: rich-editor completion interaction, accessibility and decoration
 * against a real Milkdown editor.
 */

import { undo } from '@milkdown/kit/prose/history';
import { TextSelection } from '@milkdown/kit/prose/state';
import { afterEach, describe, expect, it } from 'bun:test';
import { setEditorReadonly } from './editor.js';
import { handleCompletionKeyDown } from './template-completion-keyboard.js';
import { templateCompletionPluginKey } from './template-completion-state.js';
import { mountEditor, type MountedEditor } from './template-completion-test-utilities.js';
import { templateInvalidDecorationPluginKey } from './template-invalid-decoration-plugin.js';

const LISTBOX_ID = 'notes-placeholder-listbox-wysiwyg';
const mounted: MountedEditor[] = [];

async function mount(
  markdown: string,
  paths: string[],
  statusMessages: string[] = [],
): Promise<MountedEditor> {
  const editor = await mountEditor(markdown, {
    placeholders: { definitions: { candidates: paths.map((path) => ({ path })) } },
    placeholderListboxId: LISTBOX_ID,
    onPlaceholderStatusChange: (message) => statusMessages.push(message),
  });
  mounted.push(editor);
  return editor;
}

function popup(editor: MountedEditor): HTMLElement {
  const element = editor.container.querySelector<HTMLElement>(`[id="${LISTBOX_ID}"]`);
  if (!element) throw new Error('listbox not rendered');
  return element;
}

function options(editor: MountedEditor): HTMLElement[] {
  return [...popup(editor).querySelectorAll<HTMLElement>('[role="option"]')];
}

function documentText(editor: MountedEditor): string {
  return editor.view.state.doc.textContent;
}

function completionState(editor: MountedEditor) {
  return templateCompletionPluginKey.getState(editor.view.state);
}

afterEach(async () => {
  for (const editor of mounted.splice(0)) await editor.destroy();
});

describe('placeholder completion listbox', () => {
  it('opens at zero query characters with a named listbox and full rows', async () => {
    const editor = await mountEditor('Hi {{', {
      placeholders: {
        definitions: {
          schema: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                description: 'The account holder',
                default: { name: 'SECRET-DEFAULT' },
                properties: { name: { type: ['string', 'null'], examples: ['SECRET-EXAMPLE'] } },
              },
              anything: {},
            },
          },
        },
      },
      placeholderListboxId: LISTBOX_ID,
    });
    mounted.push(editor);
    editor.placeCaretAfter('{{');

    expect(editor.suggestionPaths()).toEqual(['anything', 'user', 'user.name']);
    const listbox = popup(editor);
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(listbox.getAttribute('aria-label')).toBe('Placeholders');
    expect(listbox.style.display).toBe('');
    expect(options(editor).map((option) => option.id)).toEqual([
      `${LISTBOX_ID}-anything`,
      `${LISTBOX_ID}-user`,
      `${LISTBOX_ID}-user.name`,
    ]);
    expect(options(editor).map((option) => option.textContent)).toEqual([
      'anythingunknown',
      'userobjectThe account holder',
      'user.namestring|null',
    ]);
    expect(listbox.textContent).not.toContain('SECRET');
    expect(options(editor).map((option) => option.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(options(editor).some((option) => option.hasAttribute('tabindex'))).toBe(false);
  });

  it('keeps every match reachable beyond the eight visible rows', async () => {
    const paths = Array.from(
      { length: 12 },
      (_, index) => `field${String(index).padStart(2, '0')}`,
    );
    const editor = await mount('{{', paths);
    editor.placeCaretAfter('{{');

    expect(options(editor)).toHaveLength(12);
    for (let step = 0; step < 20; step += 1) editor.press('ArrowDown');
    expect(completionState(editor)?.activeIndex).toBe(11);
    expect(options(editor)[11]?.getAttribute('aria-selected')).toBe('true');
  });

  it('wires the editing element to the listbox without aria-expanded', async () => {
    const editor = await mount('{{', ['alpha', 'beta']);
    const dom = editor.view.dom;

    expect(dom.getAttribute('role')).toBe('textbox');
    expect(dom.getAttribute('aria-multiline')).toBe('true');
    expect(dom.getAttribute('aria-autocomplete')).toBe('list');
    expect(dom.getAttribute('aria-haspopup')).toBe('listbox');
    expect(dom.hasAttribute('aria-controls')).toBe(false);
    expect(dom.hasAttribute('aria-activedescendant')).toBe(false);

    editor.placeCaretAfter('{{');
    expect(dom.getAttribute('aria-controls')).toBe(LISTBOX_ID);
    expect(dom.getAttribute('aria-activedescendant')).toBe(`${LISTBOX_ID}-alpha`);
    editor.press('ArrowDown');
    expect(dom.getAttribute('aria-activedescendant')).toBe(`${LISTBOX_ID}-beta`);
    expect(dom.hasAttribute('aria-expanded')).toBe(false);

    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.atStart(editor.view.state.doc)),
    );
    expect(dom.hasAttribute('aria-controls')).toBe(false);
    expect(dom.hasAttribute('aria-activedescendant')).toBe(false);
    expect(popup(editor).style.display).toBe('none');
  });

  it('announces counts, navigation detail and no matches in one status stream', async () => {
    const statusMessages: string[] = [];
    const editor = await mount('{{', ['alpha', 'beta'], statusMessages);
    editor.placeCaretAfter('{{');
    editor.press('ArrowDown');
    editor.type('z');
    editor.press('Backspace');

    expect(statusMessages.slice(0, 3)).toEqual([
      '2 placeholders available',
      'beta, unknown, 2 of 2',
      'No matching placeholders',
    ]);
    expect(popup(editor).style.display).toBe('none');
  });

  it('uses the singular for one match', async () => {
    const statusMessages: string[] = [];
    const editor = await mount('{{', ['alpha'], statusMessages);
    editor.placeCaretAfter('{{');

    expect(statusMessages).toEqual(['1 placeholder available']);
  });
});

describe('placeholder completion keyboard', () => {
  it('clamps arrow navigation at both ends', async () => {
    const editor = await mount('{{', ['a', 'b', 'c']);
    editor.placeCaretAfter('{{');

    expect(editor.press('ArrowUp')).toBe(true);
    expect(completionState(editor)?.activeIndex).toBe(0);
    editor.press('ArrowDown');
    editor.press('ArrowDown');
    editor.press('ArrowDown');
    expect(completionState(editor)?.activeIndex).toBe(2);
  });

  it('accepts inside {{user.na|me}}, replacing the whole token as one undo step', async () => {
    const editor = await mount('Hi {{user.name}} there', ['user.name', 'user.nationality']);
    editor.placeCaretAfter('{{user.na');

    expect(editor.suggestionPaths()).toEqual(['user.name', 'user.nationality']);
    editor.press('ArrowDown');
    expect(editor.press('Enter')).toBe(true);

    expect(documentText(editor)).toBe('Hi {{user.nationality}} there');
    const caret = editor.view.state.selection.from;
    expect(editor.view.state.doc.textBetween(caret - 2, caret)).toBe('}}');
    expect(completionState(editor)?.active).toBe(false);

    undo(editor.view.state, editor.view.dispatch);
    expect(documentText(editor)).toBe('Hi {{user.name}} there');
  });

  it('makes the acceptance its own undo step even when typing follows at once', async () => {
    const editor = await mount('x {{n', ['name']);
    editor.placeCaretAfter('{{n');
    editor.press('Enter');
    editor.type(' ok');
    expect(documentText(editor)).toBe('x {{name}} ok');

    undo(editor.view.state, editor.view.dispatch);
    expect(documentText(editor)).toBe('x {{name}}');
    undo(editor.view.state, editor.view.dispatch);
    expect(documentText(editor)).toBe('x {{n');
  });

  it('does not swallow prose between an opener and a later closing delimiter', async () => {
    const editor = await mount('Use {{ to open and }} to close', ['name']);
    editor.placeCaretAfter('Use {{');

    expect(editor.suggestionPaths()).toEqual(['name']);
    editor.press('Enter');
    expect(documentText(editor)).toBe('Use {{name}} to open and }} to close');
  });

  it('keeps the token run marks when accepting inside bold text', async () => {
    const editor = await mount('**Hi {{na**', ['name']);
    editor.placeCaretAfter('{{na');
    editor.press('Enter');

    const marks: string[][] = [];
    editor.view.state.doc.descendants((node) => {
      if (node.isText) marks.push(node.marks.map((mark) => mark.type.name));
    });
    expect(documentText(editor)).toBe('Hi {{name}}');
    expect(marks).toEqual([['strong']]);
  });

  it('never accepts during IME composition', async () => {
    const editor = await mount('{{na', ['name']);
    editor.placeCaretAfter('{{na');

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      cancelable: true,
    });
    expect(handleCompletionKeyDown(editor.view, event)).toBe(false);
    expect(documentText(editor)).toBe('{{na');
  });

  it('dismisses on Tab without inserting or consuming the key', async () => {
    const editor = await mount('{{na', ['name']);
    editor.placeCaretAfter('{{na');

    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    expect(handleCompletionKeyDown(editor.view, event)).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(documentText(editor)).toBe('{{na');
    expect(completionState(editor)?.dismissed).toBe(true);
  });

  it('dismisses on Tab in a list item, indents it, and stays dismissed until the next edit', async () => {
    const editor = await mount('- one\n- {{', ['name']);
    editor.placeCaretAfter('{{');
    expect(editor.suggestionPaths()).toEqual(['name']);
    const before = editor.view.state.doc;

    editor.press('Tab');

    // The editor keymap indented the item under the previous one.
    expect(editor.view.state.doc.eq(before)).toBe(false);
    let nestedLists = 0;
    editor.view.state.doc.descendants((node) => {
      if (node.type.name === 'bullet_list') nestedLists += 1;
    });
    expect(nestedLists).toBe(2);
    expect(documentText(editor)).toBe('one{{');
    expect(completionState(editor)?.dismissed).toBe(true);
    expect(completionState(editor)?.active).toBe(false);
    expect(popup(editor).style.display).toBe('none');

    // The next keypress is a separate event; let the Tab keypress finish first.
    await Promise.resolve();
    editor.type('n');
    expect(editor.suggestionPaths()).toEqual(['name']);
  });

  it('consumes only the first Escape, and the dismissal lasts until the next edit', async () => {
    const editor = await mount('{{na', ['name', 'nap']);
    editor.placeCaretAfter('{{n');

    const first = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    expect(handleCompletionKeyDown(editor.view, first)).toBe(true);
    expect(first.defaultPrevented).toBe(true);
    const second = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    expect(handleCompletionKeyDown(editor.view, second)).toBe(false);
    expect(second.defaultPrevented).toBe(false);

    editor.placeCaretAfter('{{na');
    expect(completionState(editor)?.active).toBe(false);
    editor.type('m');
    expect(editor.suggestionPaths()).toEqual(['name']);
  });

  it('leaves Home, End, Left and Right to native editing', async () => {
    const editor = await mount('{{na', ['name']);
    editor.placeCaretAfter('{{na');

    for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight', 'a']) {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      expect(handleCompletionKeyDown(editor.view, event)).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    }
  });
});

describe('placeholder completion eligibility', () => {
  it('does not open for a non-collapsed selection', async () => {
    const editor = await mount('{{name', ['name']);
    const { doc } = editor.view.state;
    editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.create(doc, 3, 5)));

    expect(completionState(editor)?.active).toBe(false);
  });

  it('does not open in inline code or a code block', async () => {
    const editor = await mount('`{{na` text\n\n```\n{{na\n```', ['name']);
    editor.placeCaretAfter('{{na');
    expect(completionState(editor)?.active).toBe(false);

    const codeBlockText = editor.view.state.doc.lastChild!;
    const end = editor.view.state.doc.content.size - 1;
    expect(codeBlockText.type.name).toBe('code_block');
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, end)),
    );
    expect(completionState(editor)?.active).toBe(false);
  });

  it('suppresses completion entirely while readonly but keeps decorations', async () => {
    const statusMessages: string[] = [];
    const editor = await mount('{{na {{nope}}', ['name'], statusMessages);
    editor.placeCaretAfter('{{na');
    expect(popup(editor).style.display).toBe('');

    setEditorReadonly(editor.state, true);
    expect(popup(editor).style.display).toBe('none');
    expect(editor.view.dom.hasAttribute('aria-autocomplete')).toBe(false);
    expect(editor.press('ArrowDown')).toBe(false);
    expect(statusMessages.at(-1)).toBe('');
    const decorations = templateInvalidDecorationPluginKey.getState(editor.view.state)?.decorations;
    expect(decorations?.find().length).toBeGreaterThan(0);
  });

  it('inserts a path whose underscores would form emphasis in Markdown as one plain run', async () => {
    const editor = await mount('{{', ['_meta_']);
    editor.placeCaretAfter('{{');
    editor.press('Enter');

    const runs: string[] = [];
    editor.view.state.doc.descendants((node) => {
      if (node.isText) runs.push(`${node.text}:${node.marks.length}`);
    });
    expect(runs).toEqual(['{{_meta_}}:0']);
    const decorations = templateInvalidDecorationPluginKey.getState(editor.view.state)?.decorations;
    expect(decorations?.find()).toEqual([]);
  });
});

describe('placeholder completion pointer', () => {
  function pointer(type: string, init: PointerEventInit = {}): PointerEvent {
    return new PointerEvent(type, { bubbles: true, cancelable: true, ...init });
  }

  it('keeps the selection on pointerdown and commits on click, restoring focus', async () => {
    const editor = await mount('{{', ['alpha', 'beta']);
    editor.placeCaretAfter('{{');
    const option = options(editor)[1]!;

    const down = pointer('pointerdown');
    option.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(documentText(editor)).toBe('{{');

    option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(documentText(editor)).toBe('{{beta}}');
    expect(editor.view.state.selection.from).toBe(1 + '{{beta}}'.length);
    expect(document.activeElement).toBe(editor.view.dom);
  });

  it('does not commit a gesture that scrolled the results', async () => {
    const editor = await mount('{{', ['alpha', 'beta']);
    editor.placeCaretAfter('{{');
    const option = options(editor)[0]!;

    option.dispatchEvent(pointer('pointerdown', { clientY: 10 }));
    option.dispatchEvent(pointer('pointermove', { clientY: 60 }));
    option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(documentText(editor)).toBe('{{');

    option.dispatchEvent(pointer('pointerdown'));
    popup(editor).dispatchEvent(new Event('scroll'));
    option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(documentText(editor)).toBe('{{');
  });

  it('commits a click with no recorded pointer gesture, as assistive technology sends', async () => {
    const editor = await mount('{{', ['alpha', 'beta']);
    editor.placeCaretAfter('{{');

    options(editor)[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(documentText(editor)).toBe('{{beta}}');
  });

  it('forgets a gesture released outside the popup, so the next click commits', async () => {
    const editor = await mount('{{', ['alpha', 'beta']);
    editor.placeCaretAfter('{{');

    options(editor)[0]!.dispatchEvent(pointer('pointerdown'));
    document.body.dispatchEvent(pointer('pointerup'));
    options(editor)[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(documentText(editor)).toBe('{{beta}}');
  });

  it('forgets a gesture whose pointer was cancelled outside the popup', async () => {
    const editor = await mount('{{', ['alpha', 'beta']);
    editor.placeCaretAfter('{{');

    options(editor)[0]!.dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }));
    document.body.dispatchEvent(pointer('pointercancel', { pointerType: 'touch' }));
    options(editor)[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(documentText(editor)).toBe('{{beta}}');
  });

  it('does not commit a cancelled touch gesture', async () => {
    const editor = await mount('{{', ['alpha']);
    editor.placeCaretAfter('{{');
    const option = options(editor)[0]!;

    const down = pointer('pointerdown', { pointerType: 'touch' });
    option.dispatchEvent(down);
    option.dispatchEvent(pointer('pointercancel', { pointerType: 'touch' }));
    option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(down.defaultPrevented).toBe(true);
    expect(documentText(editor)).toBe('{{');
  });

  it('commits a touch tap on an option', async () => {
    const editor = await mount('{{', ['alpha']);
    editor.placeCaretAfter('{{');
    const option = options(editor)[0]!;

    option.dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }));
    option.dispatchEvent(pointer('pointerup', { pointerType: 'touch' }));
    option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(documentText(editor)).toBe('{{alpha}}');
  });

  it('dismisses on an outside pointerdown without preventing it', async () => {
    const editor = await mount('{{', ['alpha']);
    editor.placeCaretAfter('{{');
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    const down = pointer('pointerdown');
    outside.dispatchEvent(down);
    outside.remove();

    expect(down.defaultPrevented).toBe(false);
    expect(completionState(editor)?.dismissed).toBe(true);
    expect(popup(editor).style.display).toBe('none');
  });
});

describe('placeholder decorations follow configuration', () => {
  it('re-validates on definition replacement without a document change', async () => {
    const editor = await mount('{{alpha}} {{beta}}', ['alpha']);
    const reasons = () =>
      templateInvalidDecorationPluginKey
        .getState(editor.view.state)
        ?.decorations.find()
        .map((decoration) => editor.view.state.doc.textBetween(decoration.from, decoration.to));
    const documentBefore = editor.view.state.doc;

    expect(reasons()).toEqual(['{{beta}}']);
    editor.state.setPlaceholderConfiguration({
      definitions: { candidates: [{ path: 'beta' }] },
    });
    expect(reasons()).toEqual(['{{alpha}}']);
    editor.state.setPlaceholderConfiguration(undefined);
    expect(reasons()).toEqual([]);
    expect(editor.view.state.doc).toBe(documentBefore);
  });
});
