/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { tick } from 'svelte';
import type { KeyValueEntry } from './key-value-editor.types.ts';
setupHappyDom();
const buttonModule = await import('../button/index.ts');
const gridModule = await import('../grid/index.ts');
const inputModule = await import('../input/index.ts');
mock.module('@lostgradient/cinder', () => buttonModule);
mock.module('@lostgradient/cinder', () => gridModule);
mock.module('@lostgradient/cinder', () => inputModule);
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: KeyValueEditor } = await import('./key-value-editor.svelte');
afterEach(cleanup);
describe('KeyValueEditor', () => {
  test('renders editable rows with unique per-instance input ids', () => {
    const first = render(KeyValueEditor, {
      entries: [{ id: 'host', key: 'Host', value: 'localhost' }],
    });
    const second = render(KeyValueEditor, {
      entries: [{ id: 'host', key: 'Host', value: 'localhost' }],
    });
    expect(first.container.querySelectorAll('input')).toHaveLength(2);
    expect(second.container.querySelectorAll('input')).toHaveLength(2);
    expect(first.container.querySelector('input')?.id).not.toBe(
      second.container.querySelector('input')?.id,
    );
  });

  test('keeps secret values editable while masking their input', () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ id: 'token', key: 'TOKEN', value: 'private' }],
      secret: (key: string) => key === 'TOKEN',
    });
    expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe(
      'private',
    );
  });

  test('syncs externally replaced entries without emitting a feedback update', async () => {
    const updates: KeyValueEntry[][] = [];
    const { container, rerender } = render(KeyValueEditor, {
      entries: [{ id: 'host', key: 'Host', value: 'localhost' }],
      onValueChange: (next: KeyValueEntry[]) => updates.push(next),
    });
    await rerender({ entries: [{ id: 'port', key: 'Port', value: '443' }] });
    expect(container.querySelectorAll('input')[0]?.value).toBe('Port');
    expect(updates).toHaveLength(0);
  });

  test('renders editable rows', () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ id: 'host', key: 'Host', value: 'localhost' }],
    });
    expect(container.querySelectorAll('input')).toHaveLength(2);
  });

  test('focuses the new key input after adding a pair, minting a unique id for the new row', async () => {
    const updates: KeyValueEntry[][] = [];
    const { container } = render(KeyValueEditor, {
      entries: [{ id: 'host', key: 'Host', value: 'localhost' }],
      onValueChange: (next: KeyValueEntry[]) => updates.push(next),
    });
    const addButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Add pair',
    );
    await fireEvent.click(addButton!);
    await tick();

    expect(updates).toHaveLength(1);
    const [firstRow, secondRow] = updates[0]!;
    expect(firstRow).toEqual({ id: 'host', key: 'Host', value: 'localhost' });
    expect(secondRow).toMatchObject({ key: '', value: '' });
    expect(typeof secondRow?.id).toBe('string');
    expect(secondRow?.id.length).toBeGreaterThan(0);
    expect(secondRow?.id).not.toBe(firstRow?.id);

    const source = readFileSync(new URL('./key-value-editor.svelte', import.meta.url), 'utf8');
    expect(source).toContain("querySelectorAll<HTMLInputElement>('input')");
    expect(source).toContain('[newIndex * 2]?.focus({ preventScroll: true })');
  });
  test('marks secret cells as password inputs', () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ id: 'token', key: 'TOKEN', value: 'private' }],
      secret: (key: string) => key === 'TOKEN',
    });
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
  });

  test('composes add and remove actions from Button', () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ id: 'host', key: 'Host', value: 'localhost' }],
    });
    expect(container.querySelectorAll('.cinder-button')).toHaveLength(2);
    expect(container.querySelector('[aria-label="Remove Host"]')?.classList).toContain(
      'cinder-button',
    );
  });

  test('restores focus to Add pair after removing the final row', async () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ id: 'host', key: 'Host', value: 'localhost' }],
    });
    const removeButton = container.querySelector<HTMLButtonElement>('[aria-label="Remove Host"]');
    const addButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Add pair',
    );

    expect(removeButton).not.toBeNull();
    expect(addButton).not.toBeNull();
    await fireEvent.click(removeButton!);

    expect(document.activeElement).toBe(requiredInstance(addButton, HTMLButtonElement));
  });

  test('restores focus to the preceding row Remove button after removing a later row', async () => {
    const { container } = render(KeyValueEditor, {
      entries: [
        { id: 'host', key: 'Host', value: 'localhost' },
        { id: 'port', key: 'Port', value: '443' },
      ],
    });
    const removePort = container.querySelector<HTMLButtonElement>('[aria-label="Remove Port"]');
    const removeHost = container.querySelector<HTMLButtonElement>('[aria-label="Remove Host"]');

    await fireEvent.click(removePort!);

    expect(document.activeElement).toBe(removeHost);
  });

  test('entry point imports only styles used by the rendered composition', () => {
    const entry = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(entry).toContain("import '../input/input.css';");
    expect(entry).toContain("import '../button/button.css';");
    expect(entry).not.toContain('secret-value-field.css');
  });

  test('stacks key-value rows within narrow containers', () => {
    const source = readFileSync(new URL('./key-value-editor.svelte', import.meta.url), 'utf8');
    const { container } = render(KeyValueEditor, {
      entries: [{ id: 'host', key: 'Host', value: 'localhost' }],
    });
    expect(container.querySelector('.cinder-key-value-editor__row')).not.toBeNull();
    expect(source).toContain('narrowCollapseEnabled');
    expect(source).toContain('columns="minmax(8rem, 1fr) minmax(12rem, 2fr) auto"');
  });

  test('composes primitives through public component subpaths', async () => {
    const source = await Bun.file(new URL('./key-value-editor.svelte', import.meta.url)).text();
    expect(source).toContain("from '../grid/index.ts';");
    expect(source).toContain("from '../input/index.ts';");
    expect(source).toContain("from '../button/index.ts';");
    expect(source).not.toContain("from '../grid/grid.svelte'");
    expect(source).not.toContain("from '../input/input.svelte'");
    expect(source).not.toContain("from '../button/button.svelte'");
  });

  // COR-504: row identity (KeyValueEntry.id) is immutable and independent of
  // the editable key/value text, so parent-driven entry updates preserve a
  // focused row's DOM node and focus instead of remounting rows by position.
  describe('COR-504: row identity across parent entry updates', () => {
    test('preserves a focused row input and its DOM node when the parent reorders, inserts, and removes other rows', async () => {
      const { container, rerender } = render(KeyValueEditor, {
        entries: [
          { id: 'a', key: 'Alpha', value: '1' },
          { id: 'b', key: 'Bravo', value: '2' },
          { id: 'c', key: 'Charlie', value: '3' },
        ],
      });
      const valueInputs = () => Array.from(container.querySelectorAll<HTMLInputElement>('input'));
      const bValueInput = valueInputs()[3]!; // [a-key, a-value, b-key, b-value, ...]
      expect(bValueInput.value).toBe('2');
      bValueInput.focus();

      // Insert a brand-new row before "a" (shifting "b" from index 1 to
      // index 2) and pass a fresh clone of "b" (new object identity, same
      // id), so this actually stresses id- vs index-based identity.
      await rerender({
        entries: [
          { id: 'd', key: 'Delta', value: '4' },
          { id: 'a', key: 'Alpha', value: '1' },
          { id: 'b', key: 'Bravo', value: '2' },
          { id: 'c', key: 'Charlie', value: '3' },
        ],
      });
      await tick();

      const bValueInputAfter = Array.from(
        container.querySelectorAll<HTMLInputElement>('input'),
      ).find((input) => input.value === '2');
      expect(bValueInputAfter).toBe(bValueInput);
      expect(document.activeElement).toBe(bValueInput);

      // Typing now updates only "b", not whatever row now sits at its old index.
      await fireEvent.input(bValueInput, { target: { value: '2-updated' } });
      expect(bValueInput.value).toBe('2-updated');
    });

    test('allows two rows with equal key and value text distinguished only by id, and editing one does not remount or unfocus it', async () => {
      const updates: KeyValueEntry[][] = [];
      const { container } = render(KeyValueEditor, {
        entries: [
          { id: 'first', key: 'DUPLICATE', value: 'same' },
          { id: 'second', key: 'DUPLICATE', value: 'same' },
        ],
        onValueChange: (next: KeyValueEntry[]) => updates.push(next),
      });
      const keyInputs = container.querySelectorAll<HTMLInputElement>('input');
      const secondKeyInput = keyInputs[2]!;
      secondKeyInput.focus();

      await fireEvent.input(secondKeyInput, { target: { value: 'RENAMED' } });

      expect(document.activeElement).toBe(secondKeyInput);
      expect(updates.at(-1)).toEqual([
        { id: 'first', key: 'DUPLICATE', value: 'same' },
        { id: 'second', key: 'RENAMED', value: 'same' },
      ]);
    });

    test('when the parent removes the focused row, focus falls back to the previous row Remove control', async () => {
      const { container, rerender } = render(KeyValueEditor, {
        entries: [
          { id: 'a', key: 'Alpha', value: '1' },
          { id: 'b', key: 'Bravo', value: '2' },
          { id: 'c', key: 'Charlie', value: '3' },
        ],
      });
      const inputs = container.querySelectorAll<HTMLInputElement>('input');
      const bKeyInput = inputs[2]!;
      bKeyInput.focus();

      await rerender({
        entries: [
          { id: 'a', key: 'Alpha', value: '1' },
          { id: 'c', key: 'Charlie', value: '3' },
        ],
      });
      await tick();
      await tick();

      expect(document.activeElement).toBe(container.querySelector('[aria-label="Remove Alpha"]'));
    });

    test('when the parent removes the first (focused) row, focus falls to the next row Remove control', async () => {
      const { container, rerender } = render(KeyValueEditor, {
        entries: [
          { id: 'a', key: 'Alpha', value: '1' },
          { id: 'b', key: 'Bravo', value: '2' },
        ],
      });
      const inputs = container.querySelectorAll<HTMLInputElement>('input');
      const aKeyInput = inputs[0]!;
      aKeyInput.focus();

      await rerender({ entries: [{ id: 'b', key: 'Bravo', value: '2' }] });
      await tick();
      await tick();

      expect(document.activeElement).toBe(container.querySelector('[aria-label="Remove Bravo"]'));
    });

    test('when the parent removes the only (focused) row, focus falls back to Add pair', async () => {
      const { container, rerender } = render(KeyValueEditor, {
        entries: [{ id: 'a', key: 'Alpha', value: '1' }],
      });
      const removeButton = container.querySelector<HTMLButtonElement>(
        '[aria-label="Remove Alpha"]',
      );
      removeButton!.focus();

      await rerender({ entries: [] });
      await tick();
      await tick();

      const addButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === 'Add pair',
      );
      expect(document.activeElement).toBe(requiredInstance(addButton, HTMLButtonElement));
    });

    test('a parent update that does not remove the focused row moves no focus', async () => {
      const { container, rerender } = render(KeyValueEditor, {
        entries: [
          { id: 'a', key: 'Alpha', value: '1' },
          { id: 'b', key: 'Bravo', value: '2' },
        ],
      });
      const removeAlpha = container.querySelector<HTMLButtonElement>('[aria-label="Remove Alpha"]');
      removeAlpha!.focus();

      await rerender({
        entries: [
          { id: 'a', key: 'Alpha', value: '1' },
          { id: 'b', key: 'Bravo', value: '2-changed' },
        ],
      });
      await tick();
      await tick();

      expect(document.activeElement).toBe(removeAlpha);
    });
  });
});
