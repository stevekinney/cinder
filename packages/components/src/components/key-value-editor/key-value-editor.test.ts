/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';
import type { KeyValueEntry } from './key-value-editor.types.ts';
setupHappyDom();
const { render } = await import('@testing-library/svelte');
const { default: KeyValueEditor } = await import('./key-value-editor.svelte');
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
});
