/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { TransferListItem } from './transfer-list.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen, within } = await import('@testing-library/svelte');
const { default: TransferList } = await import('./transfer-list.svelte');
const { default: TransferListFixture } = await import('./transfer-list.fixture.svelte');

test('uses the shared option-row cursor with its forced-colors fallback', async () => {
  const [source, rowRecipe] = await Promise.all([
    Bun.file(new URL('./transfer-list.svelte', import.meta.url)).text(),
    Bun.file(new URL('../../styles/components/_row-item.css', import.meta.url)).text(),
  ]);

  expect(source).toContain('cinder-_option-row cinder-transfer-list__option');
  expect(rowRecipe).toMatch(
    /@media \(forced-colors: active\)[\s\S]*?\.cinder-_option-row\[data-cinder-active\][\s\S]*?outline: 1px solid Highlight;/,
  );
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const items: TransferListItem[] = [
  { id: 'read', label: 'Read' },
  { id: 'write', label: 'Write' },
  { id: 'billing', label: 'Billing', disabled: true },
  { id: 'admin', label: 'Admin' },
];

describe('TransferList', () => {
  test('renders one labelled multiselect listbox with a selection count', () => {
    render(TransferList, {
      props: { items, value: ['read'], leftLabel: 'Permissions', rightLabel: 'selected' },
    });

    const list = screen.getByRole('listbox', { name: 'Permissions' });
    expect(list.getAttribute('aria-multiselectable')).toBe('true');
    expect(within(list).getAllByRole('option')).toHaveLength(4);
    expect(screen.getByText('1 item selected')).toBeTruthy();
    expect(within(list).getByRole('option', { name: /Read/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  test('preserves consumer-provided selection-label casing', () => {
    render(TransferList, {
      props: { items, value: ['read'], rightLabel: 'Granted Permissions' },
    });

    expect(screen.getByText('1 item Granted Permissions')).toBeTruthy();
  });

  test('selecting an option updates value and count', async () => {
    const onValueChange = mock(() => {});
    render(TransferList, { props: { items, value: [], onValueChange } });

    await fireEvent.click(screen.getByRole('option', { name: 'Read' }));

    expect(onValueChange).toHaveBeenCalledWith(['read']);
    expect(screen.getByText('1 item selected')).toBeTruthy();
    expect(screen.getByRole('option', { name: /Read/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('1 item selected').getAttribute('aria-live')).toBeNull();
  });

  test('clicking a selected option removes it', async () => {
    const onValueChange = mock(() => {});
    render(TransferList, { props: { items, value: ['read'], onValueChange } });

    await fireEvent.click(screen.getByRole('option', { name: /Read/ }));

    expect(onValueChange).toHaveBeenCalledWith([]);
    expect(screen.getByText('0 items selected')).toBeTruthy();
  });

  test('disabled unselected options cannot be selected', async () => {
    const onValueChange = mock(() => {});
    render(TransferList, { props: { items, value: [], onValueChange } });

    const billing = screen.getByRole('option', { name: 'Billing' });
    expect(billing.getAttribute('aria-disabled')).toBe('true');
    await fireEvent.click(billing);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test('selected disabled options remain removable', async () => {
    const onValueChange = mock(() => {});
    render(TransferList, { props: { items, value: ['billing'], onValueChange } });

    const billing = screen.getByRole('option', { name: /Billing/ });
    expect(billing.getAttribute('aria-disabled')).toBeNull();
    await fireEvent.click(billing);
    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  test('moves the active descendant after keyboard-removing a disabled selection', async () => {
    render(TransferList, { props: { items, value: ['billing'] } });
    const list = screen.getByRole('listbox');

    await fireEvent.focus(list);
    await fireEvent.keyDown(list, { key: 'ArrowDown' });
    await fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(
      document.getElementById(list.getAttribute('aria-activedescendant')!)?.textContent,
    ).toContain('Billing');

    await fireEvent.keyDown(list, { key: ' ' });

    expect(
      document.getElementById(list.getAttribute('aria-activedescendant')!)?.textContent,
    ).toContain('Admin');
    expect(screen.getByRole('option', { name: 'Billing' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  test('supports keyboard navigation and toggling', async () => {
    render(TransferList, { props: { items, value: [] } });
    const list = screen.getByRole('listbox');

    await fireEvent.focus(list);
    expect(list.getAttribute('aria-activedescendant')).toBeTruthy();
    await fireEvent.keyDown(list, { key: 'ArrowDown' });
    await fireEvent.keyDown(list, { key: ' ' });

    expect(screen.getByRole('option', { name: /Write/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  test('bind:value receives selection updates', async () => {
    render(TransferListFixture);
    expect(screen.getByTestId('value').textContent).toBe('read');
    await fireEvent.click(screen.getByRole('option', { name: 'Write' }));
    expect(screen.getByTestId('value').textContent).toBe('read,write');
  });

  test('deduplicates item IDs and drops unknown selected IDs', () => {
    render(TransferList, {
      props: {
        items: [
          { id: 'read', label: 'Read' },
          { id: 'read', label: 'Duplicate read' },
        ],
        value: ['read', 'missing', 'read'],
      },
    });

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.queryByText('Duplicate read')).toBeNull();
    expect(screen.getByText('1 item selected')).toBeTruthy();
  });
});
