/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { TransferListItem } from './transfer-list.types.ts';

setupHappyDom();

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const { cleanup, fireEvent, render, screen, waitFor, within } =
  await import('@testing-library/svelte');
const { default: TransferList } = await import('./transfer-list.svelte');
const { default: TransferListFixture } = await import('./transfer-list.fixture.svelte');

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
  test('renders two labelled multiselect listboxes and transfer controls', () => {
    render(TransferList, {
      props: { items, value: [], leftLabel: 'Available', rightLabel: 'Selected' },
    });

    const available = screen.getByRole('listbox', { name: 'Available' });
    const selected = screen.getByRole('listbox', { name: 'Selected' });
    const controls = screen.getByRole('group', { name: 'Transfer controls' });

    expect(available.getAttribute('aria-multiselectable')).toBe('true');
    expect(selected.getAttribute('aria-multiselectable')).toBe('true');
    expect(within(available).getByRole('option', { name: 'Read' })).toBeTruthy();
    expect(controls).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Move selected items to Selected' }).textContent,
    ).toBe('Add');
    expect(screen.getByRole('button', { name: 'Move all items to Selected' }).textContent).toBe(
      'Add all',
    );
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  test('disabled items expose aria-disabled and cannot be selected', async () => {
    const { container } = render(TransferList, {
      props: { items, value: [], leftLabel: 'Available', rightLabel: 'Selected' },
    });

    const billing = screen.getByRole('option', { name: 'Billing' });
    await fireEvent.click(billing);

    expect(billing.getAttribute('aria-disabled')).toBe('true');
    expect(billing.getAttribute('aria-selected')).toBe('false');
    const moveSelectedRightButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Move selected items to Selected"]',
    );
    expect(moveSelectedRightButton?.disabled).toBe(true);
  });

  test('moves selected items right and calls onChange', async () => {
    const onChange = mock(() => {});
    const { container } = render(TransferList, {
      props: { items, value: [], leftLabel: 'Available', rightLabel: 'Selected', onChange },
    });

    await fireEvent.click(screen.getByRole('option', { name: 'Read' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Move selected items to Selected' }));

    const selected = screen.getByRole('listbox', { name: 'Selected' });
    expect(within(selected).getByRole('option', { name: 'Read' })).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith(['read']);
    const moveSelectedRightButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Move selected items to Selected"]',
    );
    expect(moveSelectedRightButton?.disabled).toBe(true);
  });

  test('clicking an option focuses its listbox for keyboard follow-up', async () => {
    render(TransferList, {
      props: { items, value: [], leftLabel: 'Available', rightLabel: 'Selected' },
    });
    const available = screen.getByRole('listbox', { name: 'Available' });
    const read = within(available).getByRole('option', { name: 'Read' });

    await fireEvent.click(read);
    expect(document.activeElement).toBe(available);

    await fireEvent.keyDown(available, { key: 'ArrowDown' });
    const activeOptionId = available.getAttribute('aria-activedescendant');
    const activeOption = activeOptionId ? document.getElementById(activeOptionId) : null;
    expect(activeOption?.textContent).toBe('Write');
  });

  test('move all right excludes disabled available items', async () => {
    const onChange = mock(() => {});
    render(TransferList, {
      props: { items, value: [], leftLabel: 'Available', rightLabel: 'Selected', onChange },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Move all items to Selected' }));

    const available = screen.getByRole('listbox', { name: 'Available' });
    const selected = screen.getByRole('listbox', { name: 'Selected' });
    expect(within(available).getByRole('option', { name: 'Billing' })).toBeTruthy();
    expect(
      within(selected)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Read', 'Write', 'Admin']);
    expect(onChange).toHaveBeenCalledWith(['read', 'write', 'admin']);
  });

  test('selected disabled items can be removed', async () => {
    const onChange = mock(() => {});
    render(TransferList, {
      props: {
        items,
        value: ['billing'],
        leftLabel: 'Available',
        rightLabel: 'Selected',
        onChange,
      },
    });

    const selected = screen.getByRole('listbox', { name: 'Selected' });
    const billing = within(selected).getByRole('option', { name: 'Billing' });
    expect(billing.hasAttribute('aria-disabled')).toBe(false);

    await fireEvent.click(screen.getByRole('button', { name: 'Move all items to Available' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  test('selected items remain removable after becoming disabled', async () => {
    const onChange = mock(() => {});
    const enabledBillingItems: TransferListItem[] = items.map((item) =>
      item.id === 'billing' ? { ...item, disabled: false } : item,
    );
    const { rerender } = render(TransferList, {
      props: {
        items: enabledBillingItems,
        value: ['billing'],
        leftLabel: 'Available',
        rightLabel: 'Selected',
        onChange,
      },
    });

    await fireEvent.click(screen.getByRole('option', { name: 'Billing' }));
    await rerender({ items, value: ['billing'], leftLabel: 'Available', rightLabel: 'Selected' });
    await fireEvent.click(screen.getByRole('button', { name: 'Move selected items to Available' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  test('moves selected and all items left', async () => {
    const onChange = mock(() => {});
    render(TransferList, {
      props: {
        items,
        value: ['read', 'write', 'admin'],
        leftLabel: 'Available',
        rightLabel: 'Selected',
        onChange,
      },
    });

    await fireEvent.click(screen.getByRole('option', { name: 'Read' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Move selected items to Available' }));
    expect(onChange).toHaveBeenLastCalledWith(['write', 'admin']);

    await fireEvent.click(screen.getByRole('button', { name: 'Move all items to Available' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  test('orders selected items by value order', () => {
    render(TransferList, {
      props: { items, value: ['admin', 'read'], leftLabel: 'Available', rightLabel: 'Selected' },
    });

    const selected = screen.getByRole('listbox', { name: 'Selected' });
    expect(
      within(selected)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Admin', 'Read']);
  });

  test('deduplicates selected value IDs by first occurrence', () => {
    render(TransferList, {
      props: {
        items,
        value: ['admin', 'read', 'admin', 'missing', 'read'],
        leftLabel: 'Available',
        rightLabel: 'Selected',
      },
    });

    const selected = screen.getByRole('listbox', { name: 'Selected' });
    expect(
      within(selected)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Admin', 'Read']);
  });

  test('clears stale selection when a parent changes value', async () => {
    const { rerender } = render(TransferList, {
      props: { items, value: ['read'], leftLabel: 'Available', rightLabel: 'Selected' },
    });

    await fireEvent.click(screen.getByRole('option', { name: 'Read' }));
    expect(screen.getByRole('option', { name: 'Read' }).getAttribute('aria-selected')).toBe('true');

    await rerender({ items, value: [], leftLabel: 'Available', rightLabel: 'Selected' });
    await rerender({ items, value: ['read'], leftLabel: 'Available', rightLabel: 'Selected' });

    expect(screen.getByRole('option', { name: 'Read' }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  test('announces transfer results in the live region', async () => {
    render(TransferList, {
      props: { items, value: [], leftLabel: 'Available', rightLabel: 'Selected' },
    });

    await fireEvent.click(screen.getByRole('option', { name: 'Read' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Move selected items to Selected' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('1 item moved to Selected.'),
    );
  });

  test('keyboard navigation selects and transfers the active option', async () => {
    render(TransferList, {
      props: { items, value: [], leftLabel: 'Available', rightLabel: 'Selected' },
    });
    const available = screen.getByRole('listbox', { name: 'Available' });

    available.focus();
    await fireEvent.focus(available);
    await fireEvent.keyDown(available, { key: 'ArrowDown' });
    const activeOptionId = available.getAttribute('aria-activedescendant');
    const activeOption = activeOptionId ? document.getElementById(activeOptionId) : null;
    expect(activeOption?.textContent).toBe('Write');

    await fireEvent.keyDown(available, { key: ' ' });
    expect(activeOption?.getAttribute('aria-selected')).toBe('true');

    await fireEvent.keyDown(available, { key: 'Enter' });
    const selected = screen.getByRole('listbox', { name: 'Selected' });
    expect(within(selected).getByRole('option', { name: 'Write' })).toBeTruthy();
  });

  test('renders empty states and ignores orphaned value IDs', () => {
    render(TransferList, {
      props: {
        items: [{ id: 'read', label: 'Read' }],
        value: ['read', 'missing'],
        leftLabel: 'Available',
        rightLabel: 'Selected',
      },
    });

    expect(screen.getByText('No available items')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Read' })).toBeTruthy();
    expect(screen.queryByText('missing')).toBeNull();
  });

  test('ignores duplicate item IDs after the first occurrence', () => {
    render(TransferList, {
      props: {
        items: [
          { id: 'read', label: 'Read' },
          { id: 'read', label: 'Duplicate read' },
        ],
        value: [],
      },
    });

    expect(screen.getByRole('option', { name: 'Read' })).toBeTruthy();
    expect(screen.queryByText('Duplicate read')).toBeNull();
  });

  test('bind:value receives transfer updates', async () => {
    render(TransferListFixture);
    expect(screen.getByTestId('value').textContent).toBe('read');

    await fireEvent.click(screen.getByRole('option', { name: 'Write' }));
    await fireEvent.click(
      screen.getByRole('button', { name: 'Move selected items to Granted permissions' }),
    );

    expect(screen.getByTestId('value').textContent).toBe('read,write');
  });

  test('index import is SSR-safe', async () => {
    const module = await import('./index.ts');
    expect(typeof module.default).toBe('function');
    expect(module.TransferList).toBe(module.default);
  });

  test('responsive layout uses a container query instead of viewport media', async () => {
    const stylesheet = await Bun.file(join(currentDirectory, 'transfer-list.css')).text();

    expect(stylesheet).toContain('container-type: inline-size;');
    expect(stylesheet).toContain('container-name: cinder-transfer-list;');
    expect(stylesheet).toContain('@container cinder-transfer-list (max-width: 42rem)');
    expect(stylesheet).not.toContain('@media (max-width: 42rem)');
  });
});
