// @ts-nocheck — test file; noUncheckedIndexedAccess and bun:test types disabled per project convention
/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';
import { SortableController, reorder } from '../utilities/sortable-controller.svelte.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: SortableList } = await import('./sortable-list.svelte');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Item = { id: string; label: string };

const ITEMS: Item[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

function getKey(item: Item) {
  return item.id;
}

function getItemLabel(item: Item) {
  return item.label;
}

function emptySnippet() {
  return createRawSnippet(() => ({
    render: () => `<span></span>`,
    setup: () => {},
  }));
}

function renderList(overrides?: Record<string, unknown>) {
  const onreorder = mock();
  const { container, ...rest } = render(SortableList as any, {
    props: {
      items: ITEMS,
      getKey,
      getItemLabel,
      onreorder,
      label: 'Test list',
      children: emptySnippet(),
      ...overrides,
    },
  });
  return { container, onreorder, ...rest };
}

// ---------------------------------------------------------------------------
// Controller unit tests (no DOM)
// ---------------------------------------------------------------------------

describe('SortableController', () => {
  test('lift sets phase, key, from/to, liftedLabel, and calls announce', () => {
    const announce = mock();
    const controller = new SortableController({ announce });

    controller.lift('a', 0, 'Alpha', 3);

    expect(controller.phase).toBe('lifted');
    expect(controller.liftedKey).toBe('a');
    expect(controller.liftedLabel).toBe('Alpha');
    expect(controller.liftedFrom).toBe(0);
    expect(controller.liftedTo).toBe(0);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0][0]).toContain('Alpha');
    expect(announce.mock.calls[0][0]).toContain('1 of 3');
  });

  test('move updates liftedTo and announces only on actual change', () => {
    const announce = mock();
    const controller = new SortableController({ announce });
    controller.lift('a', 0, 'Alpha', 3);
    announce.mockClear();

    controller.move(1, 'Alpha', 3);
    expect(controller.liftedTo).toBe(1);
    expect(announce).toHaveBeenCalledTimes(1);

    // Same index again — no re-announce.
    controller.move(1, 'Alpha', 3);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  test('move clamps to [0, total-1] without announcing out-of-bounds', () => {
    const announce = mock();
    const controller = new SortableController({ announce });
    controller.lift('a', 0, 'Alpha', 3);
    announce.mockClear();

    controller.move(-5, 'Alpha', 3);
    expect(controller.liftedTo).toBe(0);
    expect(announce).toHaveBeenCalledTimes(0); // Already at 0, clamped, no change.

    controller.move(100, 'Alpha', 3);
    expect(controller.liftedTo).toBe(2);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  test('drop with different from/to returns nextItems with correct order and calls announce', () => {
    const announce = mock();
    const controller = new SortableController<Item>({ announce });
    const items: Item[] = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ];
    controller.lift('a', 0, 'Alpha', 3);
    controller.move(2, 'Alpha', 3);
    announce.mockClear();

    const result = controller.drop(items, 'Alpha');

    expect(result).not.toBeNull();
    expect(result!.nextItems.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(result!.change).toEqual({ itemKey: 'a', fromIndex: 0, toIndex: 2 });
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0][0]).toContain('dropped');
    expect(controller.phase).toBe('idle');
  });

  test('drop with same from/to returns null but still announces dropped', () => {
    const announce = mock();
    const controller = new SortableController<Item>({ announce });
    const items: Item[] = [{ id: 'a', label: 'Alpha' }];
    controller.lift('a', 0, 'Alpha', 1);
    announce.mockClear();

    const result = controller.drop(items, 'Alpha');

    expect(result).toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0][0]).toContain('dropped');
  });

  test('cancel resets all state fields, announces cancelled', () => {
    const announce = mock();
    const controller = new SortableController({ announce });
    controller.lift('a', 0, 'Alpha', 3);
    controller.move(2, 'Alpha', 3);
    announce.mockClear();

    controller.cancel('Alpha');

    expect(controller.phase).toBe('idle');
    expect(controller.liftedKey).toBeNull();
    expect(controller.liftedLabel).toBe('');
    expect(controller.liftedFrom).toBe(0);
    expect(controller.liftedTo).toBe(0);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0][0]).toContain('cancelled');
  });

  test('cancel in idle phase is a no-op', () => {
    const announce = mock();
    const controller = new SortableController({ announce });

    controller.cancel('Alpha');

    expect(announce).not.toHaveBeenCalled();
    expect(controller.phase).toBe('idle');
  });

  test('reconcileLiftedKey when key is missing auto-cancels with stored liftedLabel', () => {
    const announce = mock();
    const controller = new SortableController<Item>({ announce });
    controller.lift('a', 0, 'Alpha', 2);
    announce.mockClear();

    // Remove item 'a' from the list.
    controller.reconcileLiftedKey([{ id: 'b', label: 'Beta' }], getKey);

    expect(controller.phase).toBe('idle');
    expect(announce).toHaveBeenCalledTimes(1);
    // Announcement should use the stored label "Alpha" (not an empty string).
    expect(announce.mock.calls[0][0]).toContain('Alpha');
    expect(announce.mock.calls[0][0]).toContain('cancelled');
  });

  test('reconcileLiftedKey when key moved updates liftedFrom without announcing', () => {
    const announce = mock();
    const controller = new SortableController<Item>({ announce });
    const items: Item[] = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ];
    controller.lift('a', 0, 'Alpha', 2);
    announce.mockClear();

    // Simulate parent inserting item at front, pushing 'a' to index 1.
    const reordered: Item[] = [{ id: 'x', label: 'X' }, ...items];
    controller.reconcileLiftedKey(reordered, getKey);

    expect(controller.phase).toBe('lifted');
    expect(controller.liftedFrom).toBe(1);
    expect(announce).toHaveBeenCalledTimes(0);
  });

  test('custom announcements override defaults', () => {
    const announce = mock();
    const controller = new SortableController({
      announce,
      announcements: {
        lifted: (label: string, _position: number, _total: number) => `CUSTOM LIFT ${label}`,
      },
    });

    controller.lift('a', 0, 'Alpha', 3);

    expect(announce.mock.calls[0][0]).toBe('CUSTOM LIFT Alpha');
  });
});

// ---------------------------------------------------------------------------
// reorder helper
// ---------------------------------------------------------------------------

describe('reorder', () => {
  test('moves item from fromIndex to toIndex', () => {
    const result = reorder(['a', 'b', 'c'], 0, 2);
    expect(result).toEqual(['b', 'c', 'a']);
  });

  test('does not mutate input array', () => {
    const input = ['a', 'b', 'c'];
    reorder(input, 0, 1);
    expect(input).toEqual(['a', 'b', 'c']);
  });

  test('handles move to same index', () => {
    expect(reorder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  test('handles move from last to first', () => {
    expect(reorder(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// Component tests
// ---------------------------------------------------------------------------

describe('SortableList', () => {
  test('renders list root with role=list and aria-label', () => {
    const { container } = renderList();
    const list = container.querySelector('.cinder-sortable-list');
    expect(list).not.toBeNull();
    expect(list?.getAttribute('role')).toBe('list');
    expect(list?.getAttribute('aria-label')).toBe('Test list');
  });

  test('renders one sortable item per data item', () => {
    const { container } = renderList();
    const items = container.querySelectorAll('[data-sortable-row]');
    expect(items.length).toBe(3);
  });

  test('each handle has aria-label from formatHandleLabel (default: "Reorder {label}")', () => {
    const { container } = renderList();
    const handles = container.querySelectorAll('.cinder-sortable-handle');
    expect(handles.length).toBe(3);
    expect(handles[0].getAttribute('aria-label')).toBe('Reorder Alpha');
    expect(handles[1].getAttribute('aria-label')).toBe('Reorder Beta');
    expect(handles[2].getAttribute('aria-label')).toBe('Reorder Gamma');
  });

  test('custom formatHandleLabel is applied to handles', () => {
    const { container } = renderList({
      formatHandleLabel: (label: string) => `Drag ${label}`,
    });
    const handles = container.querySelectorAll('.cinder-sortable-handle');
    expect(handles[0].getAttribute('aria-label')).toBe('Drag Alpha');
  });

  test('handle has aria-pressed=false initially', () => {
    const { container } = renderList();
    const handle = container.querySelector('.cinder-sortable-handle');
    expect(handle?.getAttribute('aria-pressed')).toBe('false');
  });

  test('handle has aria-describedby pointing to instructions element', () => {
    const { container } = renderList();
    const handle = container.querySelector('.cinder-sortable-handle');
    const describedBy = handle?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const instructions = container.querySelector(`#${describedBy}`);
    expect(instructions).not.toBeNull();
    expect(instructions?.textContent?.trim().length).toBeGreaterThan(0);
  });

  test('hidden instructions element exists exactly once', () => {
    const { container } = renderList();
    const firstHandle = container.querySelector('.cinder-sortable-handle');
    const instructionsId = firstHandle?.getAttribute('aria-describedby');
    const elements = container.querySelectorAll(`[id="${instructionsId}"]`);
    expect(elements.length).toBe(1);
  });

  test('Space on handle lifts item — aria-pressed becomes true', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });

    expect(handle.getAttribute('aria-pressed')).toBe('true');
  });

  test('Arrow Down moves lifted item to next visual position', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' }); // Lift Alpha (was at index 0).
    await fireEvent.keyDown(handle, { key: 'ArrowDown' }); // Move to index 1.

    // Alpha should now appear at visual index 1; Beta should have shifted to index 0.
    const rows = container.querySelectorAll('[data-sortable-row]');
    expect(rows[0].getAttribute('data-key')).toBe('b'); // Beta shifted to first.
    expect(rows[1].getAttribute('data-key')).toBe('a'); // Alpha at second.
    expect(handle.getAttribute('aria-pressed')).toBe('true');
  });

  test('Arrow Down at last position clamps — item stays at last slot', async () => {
    const { container } = renderList();
    const handles = container.querySelectorAll('.cinder-sortable-handle');
    const lastHandle = handles[handles.length - 1] as HTMLElement; // Gamma at index 2.

    await fireEvent.keyDown(lastHandle, { key: ' ' });
    await fireEvent.keyDown(lastHandle, { key: 'ArrowDown' }); // At last — clamps.

    const rows = container.querySelectorAll('[data-sortable-row]');
    expect(rows[2].getAttribute('data-key')).toBe('c'); // Gamma stays at index 2.
    expect(lastHandle.getAttribute('aria-pressed')).toBe('true');
  });

  test('Arrow Up at first position clamps — item stays at first slot', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement; // Alpha at index 0.

    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowUp' }); // Already at 0 — clamps.

    const rows = container.querySelectorAll('[data-sortable-row]');
    expect(rows[0].getAttribute('data-key')).toBe('a'); // Alpha stays at index 0.
    expect(handle.getAttribute('aria-pressed')).toBe('true');
  });

  test('End moves lifted item to last visual position', async () => {
    const { container } = renderList();
    const handles = container.querySelectorAll('.cinder-sortable-handle');
    const middleHandle = handles[1] as HTMLElement; // Beta at index 1.

    await fireEvent.keyDown(middleHandle, { key: ' ' }); // Lift Beta.
    await fireEvent.keyDown(middleHandle, { key: 'End' }); // Move to last.

    const rows = container.querySelectorAll('[data-sortable-row]');
    expect(rows[2].getAttribute('data-key')).toBe('b'); // Beta moved to index 2.
  });

  test('Home moves lifted item to first visual position', async () => {
    const { container } = renderList();
    const handles = container.querySelectorAll('.cinder-sortable-handle');
    const middleHandle = handles[1] as HTMLElement; // Beta at index 1.

    await fireEvent.keyDown(middleHandle, { key: ' ' }); // Lift Beta.
    await fireEvent.keyDown(middleHandle, { key: 'Home' }); // Move to first.

    const rows = container.querySelectorAll('[data-sortable-row]');
    expect(rows[0].getAttribute('data-key')).toBe('b'); // Beta moved to index 0.
  });

  test('Space drops and calls onreorder with reordered array', async () => {
    const { container, onreorder } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' }); // Lift Alpha.
    await fireEvent.keyDown(handle, { key: 'ArrowDown' }); // Move to position 2.
    await fireEvent.keyDown(handle, { key: ' ' }); // Drop.

    expect(onreorder).toHaveBeenCalledTimes(1);
    const [nextItems, change] = onreorder.mock.calls[0];
    expect(nextItems.map((i: Item) => i.id)).toEqual(['b', 'a', 'c']);
    expect(change.fromIndex).toBe(0);
    expect(change.toIndex).toBe(1);
    expect(change.itemKey).toBe('a');
    expect(handle.getAttribute('aria-pressed')).toBe('false');
  });

  test('Escape cancels — onreorder not called, aria-pressed returns false', async () => {
    const { container, onreorder } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await fireEvent.keyDown(handle, { key: 'Escape' });

    expect(onreorder).not.toHaveBeenCalled();
    expect(handle.getAttribute('aria-pressed')).toBe('false');
  });

  test('drop at same position does not call onreorder', async () => {
    const { container, onreorder } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' }); // Lift.
    await fireEvent.keyDown(handle, { key: ' ' }); // Drop at same index.

    expect(onreorder).not.toHaveBeenCalled();
  });

  test('onreorder receives full reordered array and correct change metadata', async () => {
    const { container, onreorder } = renderList();
    const handles = container.querySelectorAll('.cinder-sortable-handle');
    const lastHandle = handles[handles.length - 1] as HTMLElement; // Gamma (index 2).

    await fireEvent.keyDown(lastHandle, { key: ' ' }); // Lift Gamma.
    await fireEvent.keyDown(lastHandle, { key: 'ArrowUp' }); // Move to index 1.
    await fireEvent.keyDown(lastHandle, { key: ' ' }); // Drop.

    expect(onreorder).toHaveBeenCalledTimes(1);
    const [nextItems, change] = onreorder.mock.calls[0];
    expect(nextItems.length).toBe(3);
    expect(change.itemKey).toBe('c');
    expect(change.fromIndex).toBe(2);
    expect(change.toIndex).toBe(1);
  });

  test('component does not mutate the items prop', async () => {
    const original = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ];
    const frozen = Object.freeze(original.map((i) => Object.freeze({ ...i })));
    const { container, onreorder } = renderList({
      items: frozen as any,
      label: 'Frozen list',
    });

    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await fireEvent.keyDown(handle, { key: ' ' });

    // If items were mutated, the frozen object would throw. No throw = no mutation.
    expect(onreorder).toHaveBeenCalledTimes(1);
    expect(frozen.map((i: Item) => i.id)).toEqual(['a', 'b']); // Unchanged.
  });

  test('list root has role=list and aria-label when label prop is set', () => {
    const { container } = renderList({ label: 'My tasks' });
    const list = container.querySelector('.cinder-sortable-list');
    expect(list?.getAttribute('role')).toBe('list');
    expect(list?.getAttribute('aria-label')).toBe('My tasks');
  });

  test('announcements prop flows to live region on lift', async () => {
    const { container } = renderList({
      announcements: {
        lifted: (label: string, _position: number, _total: number) => `CUSTOM ${label} LIFTED`,
      },
    });
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });

    // The live region text is set asynchronously via setTimeout(0) in useAnnouncer.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const liveRegion = container.querySelector('[role="alert"]');
    expect(liveRegion?.textContent).toContain('CUSTOM Alpha LIFTED');
  });
});
