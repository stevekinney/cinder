// @ts-nocheck — test file; noUncheckedIndexedAccess and bun:test types disabled per project convention
/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { SortableController, reorder } from '../../utilities/sortable-controller.svelte.ts';

setupHappyDom();

const { cleanup, render, fireEvent } = await import('@testing-library/svelte');
const { default: SortableList } = await import('./sortable-list.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

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

  test('completeDrop announces and resets without requiring a list item array', () => {
    const announce = mock();
    const controller = new SortableController<Item>({ announce });
    controller.lift('a', 0, 'Alpha', 2);
    controller.move(1, 'Alpha', 2);
    announce.mockClear();

    controller.completeDrop('Alpha', 2);

    expect(controller.phase).toBe('idle');
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0][0]).toContain('2 of 2');
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

  test('lift while already lifted is a no-op (prevents concurrent drag corruption)', () => {
    const announce = mock();
    const controller = new SortableController({ announce });

    controller.lift('a', 0, 'Alpha', 3);
    announce.mockClear();

    // Attempt to lift a second item while 'a' is still lifted.
    controller.lift('b', 1, 'Beta', 3);

    expect(announce).not.toHaveBeenCalled();
    expect(controller.liftedKey).toBe('a');
    expect(controller.liftedFrom).toBe(0);
    expect(controller.phase).toBe('lifted');
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

  test('reconcileLiftedKey clamps liftedTo when list shrinks from the end (index unchanged)', () => {
    const announce = mock();
    const controller = new SortableController<Item>({ announce });
    const items: Item[] = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ];
    // Lift 'a' and move it to position 2 (last).
    controller.lift('a', 0, 'Alpha', 3);
    controller.move(2, 'Alpha', 3);
    expect(controller.liftedTo).toBe(2);

    // Parent removes 'c' from the end; 'a' is still at index 0 so currentIndex === liftedFrom.
    const shrunk: Item[] = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ];
    controller.reconcileLiftedKey(shrunk, getKey);

    expect(controller.phase).toBe('lifted');
    // liftedTo must be clamped to the new last index (1), not left at 2.
    expect(controller.liftedTo).toBe(1);
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

  test('returns array unchanged for a beyond-bounds positive fromIndex', () => {
    // Regression: a fromIndex beyond the array length makes splice return []
    // (removed is undefined); the guard returns the unchanged array rather than
    // inserting undefined at toIndex.
    expect(reorder(['a', 'b', 'c'], 5, 0)).toEqual(['a', 'b', 'c']);
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

// ---------------------------------------------------------------------------
// Pointer drag preview state contract tests
// ---------------------------------------------------------------------------
//
// happy-dom cannot prove pixels, so we test the STATE CONTRACT:
//   - During a pointer drag a [data-cinder-drag-preview] portal is appended to body.
//   - The lifted row gains cinder-sortable-item--placeholder (not --lifted).
//   - The preview element is present in document.body (not inside the list).
//   - data-preview-x / data-preview-y on the lifted row track pointer coords.
//   - On drop the preview is removed and the placeholder class is gone.
//   - On pointer cancel the preview is removed.
//   - On Escape during pointer drag the preview is removed.
//   - Keyboard lifts do NOT create a preview portal (preview is pointer-only).

function installPointerCaptureOnHandle(handle: HTMLElement): void {
  handle.setPointerCapture = mock(() => {});
  handle.releasePointerCapture = mock(() => {});
  handle.hasPointerCapture = mock(() => true);
}

async function waitForAnimationFrame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe('SortableList pointer drag preview', () => {
  afterEach(() => {
    // Clean up any orphaned portals that a failing test left behind.
    document.querySelectorAll('[data-cinder-drag-preview]').forEach((element) => element.remove());
  });

  test('pointer drag appends a drag preview portal to document.body', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const preview = document.querySelector('[data-cinder-drag-preview]');
    expect(preview).not.toBeNull();
    // Preview must be on body, not inside the list container.
    expect(document.body.contains(preview)).toBe(true);
    expect(container.contains(preview)).toBe(false);

    // Cleanup.
    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });

  test('preview has aria-hidden=true so it does not duplicate AT content', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const preview = document.querySelector('[data-cinder-drag-preview]');
    expect(preview?.getAttribute('aria-hidden')).toBe('true');

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });

  test('lifted row has --placeholder class during pointer drag (not --lifted)', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const liftedRow = container.querySelector('[data-key="a"]') as HTMLElement;
    expect(liftedRow?.classList.contains('cinder-sortable-item--placeholder')).toBe(true);
    expect(liftedRow?.classList.contains('cinder-sortable-item--lifted')).toBe(false);

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });

  test('lifted row exposes data-preview-x and data-preview-y during pointer drag', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const liftedRow = container.querySelector('[data-key="a"]') as HTMLElement;
    expect(liftedRow?.getAttribute('data-preview-x')).toBe('50');
    expect(liftedRow?.getAttribute('data-preview-y')).toBe('100');

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });

  test('preview position attributes update on pointer move', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await fireEvent.pointerMove(handle, {
      clientX: 80,
      clientY: 160,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await waitForAnimationFrame();

    const liftedRow = container.querySelector('[data-key="a"]') as HTMLElement;
    expect(liftedRow?.getAttribute('data-preview-x')).toBe('80');
    expect(liftedRow?.getAttribute('data-preview-y')).toBe('160');

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });

  test('drop removes the preview portal from document.body', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(document.querySelector('[data-cinder-drag-preview]')).not.toBeNull();

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });

    expect(document.querySelector('[data-cinder-drag-preview]')).toBeNull();
  });

  test('drop clears placeholder class and data-preview-x/y from the row', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });

    const row = container.querySelector('[data-key="a"]') as HTMLElement;
    expect(row?.classList.contains('cinder-sortable-item--placeholder')).toBe(false);
    expect(row?.hasAttribute('data-preview-x')).toBe(false);
    expect(row?.hasAttribute('data-preview-y')).toBe(false);
  });

  test('pointercancel removes the preview portal (cancel path)', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(document.querySelector('[data-cinder-drag-preview]')).not.toBeNull();

    await fireEvent.pointerCancel(handle, { pointerId: 1, pointerType: 'mouse' });

    expect(document.querySelector('[data-cinder-drag-preview]')).toBeNull();
  });

  test('Escape during pointer drag removes the preview portal', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(document.querySelector('[data-cinder-drag-preview]')).not.toBeNull();

    await fireEvent.keyDown(handle, { key: 'Escape' });

    expect(document.querySelector('[data-cinder-drag-preview]')).toBeNull();
  });

  test('keyboard lift does NOT create a preview portal', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });

    // Keyboard drag: no preview portal should exist.
    expect(document.querySelector('[data-cinder-drag-preview]')).toBeNull();
    // Keyboard drag: row should have --lifted class, not --placeholder.
    const row = container.querySelector('[data-key="a"]') as HTMLElement;
    expect(row?.classList.contains('cinder-sortable-item--lifted')).toBe(true);
    expect(row?.classList.contains('cinder-sortable-item--placeholder')).toBe(false);

    // Cleanup.
    await fireEvent.keyDown(handle, { key: 'Escape' });
  });

  test('window Escape during pointer drag removes the preview portal', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(document.querySelector('[data-cinder-drag-preview]')).not.toBeNull();

    // Simulate window-level Escape (SortableList's handleWindowKeydown).
    await fireEvent.keyDown(window, { key: 'Escape' });

    expect(document.querySelector('[data-cinder-drag-preview]')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Regression: orphaned rAF after Escape — Issue 3 fix verification
  // ---------------------------------------------------------------------------
  //
  // Before the fix, destroyPreviewPortal() did not cancel moveRafHandle. A
  // queued rAF from handlePointerMove could fire after the portal was removed,
  // then clear moveRafHandle to null. If a second drag started before that
  // frame fired, the orphan would clobber the second session's rAF gate and
  // drive the new portal with stale coordinates from the first drag.

  test('Escape during pointer drag followed by queued rAF — no orphaned frame / no leftover portal', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    // Queue a move rAF by sending a pointer move (rAF will be scheduled).
    await fireEvent.pointerMove(handle, {
      clientX: 60,
      clientY: 110,
      pointerId: 1,
      pointerType: 'mouse',
    });

    // Cancel via Escape before the rAF fires.
    await fireEvent.keyDown(handle, { key: 'Escape' });

    // Drain the rAF queue — the cancelled/destroyed portal must not survive.
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(0);
  });

  test('portal count is 0 when idle and exactly 1 during a single drag', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    // Idle: no portals.
    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(0);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    // During drag: exactly 1 portal.
    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(1);

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });

    // After drop: no portals.
    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(0);
  });

  test('rejected lift (another item already lifted) does NOT create an orphaned preview portal', async () => {
    const { container } = renderList();
    const handles = container.querySelectorAll('.cinder-sortable-handle');
    const firstHandle = handles[0] as HTMLElement;
    const secondHandle = handles[1] as HTMLElement;
    installPointerCaptureOnHandle(firstHandle);
    installPointerCaptureOnHandle(secondHandle);

    // Lift the first item.
    await fireEvent.pointerDown(firstHandle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(1);

    // Attempt a second pointerdown on a different item while the first is still lifted.
    // The controller rejects the concurrent lift; no second portal should be created.
    await fireEvent.pointerDown(secondHandle, {
      button: 0,
      clientX: 50,
      clientY: 200,
      pointerId: 2,
      pointerType: 'mouse',
    });

    // Still exactly one portal — the second lift was rejected.
    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(1);

    // Clean up the first drag.
    await fireEvent.pointerUp(firstHandle, { pointerId: 1, pointerType: 'mouse' });
    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(0);
  });

  test('rapid second drag after drop does not leave extra portals', async () => {
    const { container } = renderList();
    const handle = container.querySelectorAll('.cinder-sortable-handle')[0] as HTMLElement;
    installPointerCaptureOnHandle(handle);

    // First drag.
    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });

    // Second drag immediately after.
    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 2,
      pointerType: 'mouse',
    });

    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(1);

    await fireEvent.pointerUp(handle, { pointerId: 2, pointerType: 'mouse' });

    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Regression: clone id stripping — Issue 2 fix verification
  // ---------------------------------------------------------------------------

  test('preview portal clone does not duplicate id attributes from the source row', async () => {
    // Use a single-item list so there is exactly one element carrying the test
    // id in the container, making the before/after count unambiguous.
    const singleItem = [{ id: 'solo', label: 'Solo' }];
    const idSnippet = createRawSnippet(() => ({
      render: () => `<span id="unique-span-id">content</span>`,
      setup: () => {},
    }));

    const { container } = render(SortableList as any, {
      props: {
        items: singleItem,
        getKey: (item: { id: string }) => item.id,
        getItemLabel: (item: { label: string }) => item.label,
        onreorder: mock(),
        label: 'Id test list',
        children: idSnippet,
      },
    });

    const handle = container.querySelector('.cinder-sortable-handle') as HTMLElement;
    installPointerCaptureOnHandle(handle);

    // Pre-drag: exactly one element with the id inside the container.
    expect(container.querySelectorAll('#unique-span-id').length).toBe(1);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    // The source row still has the id.
    expect(container.querySelectorAll('#unique-span-id').length).toBe(1);
    // The portal clone must NOT contain any element with that id.
    const portal = document.querySelector('[data-cinder-drag-preview]') as HTMLElement;
    expect(portal).not.toBeNull();
    expect(portal.querySelectorAll('#unique-span-id').length).toBe(0);
    // The portal itself must have no id attribute.
    expect(portal.hasAttribute('id')).toBe(false);
    // The portal must carry inert to suppress interaction.
    expect(portal.hasAttribute('inert')).toBe(true);
    // Document-wide: only one element with this id exists (in the source).
    expect(document.querySelectorAll('#unique-span-id').length).toBe(1);

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });
});
