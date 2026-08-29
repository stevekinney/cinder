/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { setupHappyDom } from '../../test/happy-dom.ts';
import type { KeyValueEntry } from './key-value-editor.types.ts';
setupHappyDom();
const buttonModule = await import('../button/index.ts');
const gridModule = await import('../grid/index.ts');
const inputModule = await import('../input/index.ts');
mock.module('@lostgradient/cinder/button', () => buttonModule);
mock.module('@lostgradient/cinder/grid', () => gridModule);
mock.module('@lostgradient/cinder/input', () => inputModule);
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: KeyValueEditor } = await import('./key-value-editor.svelte');
afterEach(cleanup);
describe('KeyValueEditor', () => {
  test('renders editable rows with unique per-instance input ids', () => {
    const first = render(KeyValueEditor, { entries: [{ key: 'Host', value: 'localhost' }] });
    const second = render(KeyValueEditor, { entries: [{ key: 'Host', value: 'localhost' }] });
    expect(first.container.querySelectorAll('input')).toHaveLength(2);
    expect(second.container.querySelectorAll('input')).toHaveLength(2);
    expect(first.container.querySelector('input')?.id).not.toBe(
      second.container.querySelector('input')?.id,
    );
  });

  test('keeps secret values editable while masking their input', () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ key: 'TOKEN', value: 'private' }],
      secret: (key: string) => key === 'TOKEN',
    });
    expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe(
      'private',
    );
  });

  test('syncs externally replaced entries without emitting a feedback update', async () => {
    const updates: KeyValueEntry[][] = [];
    const { container, rerender } = render(KeyValueEditor, {
      entries: [{ key: 'Host', value: 'localhost' }],
      onValueChange: (next: KeyValueEntry[]) => updates.push(next),
    });
    await rerender({ entries: [{ key: 'Port', value: '443' }] });
    expect(container.querySelectorAll('input')[0]?.value).toBe('Port');
    expect(updates).toHaveLength(0);
  });

  test('renders editable rows', () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ key: 'Host', value: 'localhost' }],
    });
    expect(container.querySelectorAll('input')).toHaveLength(2);
  });
  test('marks secret cells as password inputs', () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ key: 'TOKEN', value: 'private' }],
      secret: (key: string) => key === 'TOKEN',
    });
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
  });

  test('composes add and remove actions from Button', () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ key: 'Host', value: 'localhost' }],
    });
    expect(container.querySelectorAll('.cinder-button')).toHaveLength(2);
    expect(container.querySelector('[aria-label="Remove Host"]')?.classList).toContain(
      'cinder-button',
    );
  });

  test('restores focus to Add pair after removing the final row', async () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ key: 'Host', value: 'localhost' }],
    });
    const removeButton = container.querySelector<HTMLButtonElement>('[aria-label="Remove Host"]');
    const addButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Add pair',
    );

    expect(removeButton).not.toBeNull();
    expect(addButton).not.toBeNull();
    await fireEvent.click(removeButton!);

    expect(document.activeElement).toBe(addButton as HTMLButtonElement);
  });

  test('restores focus to the preceding row Remove button after removing a later row', async () => {
    const { container } = render(KeyValueEditor, {
      entries: [
        { key: 'Host', value: 'localhost' },
        { key: 'Port', value: '443' },
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
    const css = readFileSync(new URL('./key-value-editor.css', import.meta.url), 'utf8');
    const { container } = render(KeyValueEditor, {
      entries: [{ key: 'Host', value: 'localhost' }],
    });
    expect(container.querySelector('.cinder-key-value-editor__row')).not.toBeNull();
    expect(css).toContain('@container cinder-grid (max-width: 48rem)');
    expect(css).toContain('grid-column: 1 / -1;');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) auto;');
  });

  test('composes primitives through public component subpaths', async () => {
    const source = await Bun.file(new URL('./key-value-editor.svelte', import.meta.url)).text();
    expect(source).toContain("from '@lostgradient/cinder/grid';");
    expect(source).toContain("from '@lostgradient/cinder/input';");
    expect(source).toContain("from '@lostgradient/cinder/button';");
    expect(source).not.toContain("from '../grid/grid.svelte'");
    expect(source).not.toContain("from '../input/input.svelte'");
    expect(source).not.toContain("from '../button/button.svelte'");
  });
});
