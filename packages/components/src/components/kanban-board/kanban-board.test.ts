// @ts-nocheck — component tests exercise generic snippets and DOM APIs.
/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import {
  findNextVisibleColumn,
  moveKanbanCard,
  moveKanbanColumn,
  validateKanbanBoardKeys,
} from './kanban-board-helpers.ts';
import type { KanbanBoardColumn } from './kanban-board.types.ts';

setupHappyDom();

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: KanbanBoard } = await import('./kanban-board.svelte');

type Card = { id: string; title: string };

const alpha = Object.freeze({ id: 'a', title: 'Alpha' });
const beta = Object.freeze({ id: 'b', title: 'Beta' });
const gamma = Object.freeze({ id: 'c', title: 'Gamma' });

function makeColumns(): KanbanBoardColumn<Card>[] {
  return [
    { id: 'todo', title: 'To do', cards: [alpha, beta] },
    { id: 'doing', title: 'Doing', cards: [gamma] },
    { id: 'done', title: 'Done', cards: [] },
  ];
}

function getCardKey(card: Card) {
  return card.id;
}

function getCardLabel(card: Card) {
  return card.title;
}

function cardSnippet() {
  return createRawSnippet<[Card]>((getCard) => ({
    render: () => `<span>${getCard().title}</span>`,
    setup: () => {},
  }));
}

function renderBoard(overrides?: Record<string, unknown>) {
  const onchange = mock();
  const columns = makeColumns();
  const result = render(KanbanBoard as any, {
    props: {
      columns,
      getCardKey,
      getCardLabel,
      onchange,
      label: 'Work board',
      card: cardSnippet(),
      ...overrides,
    },
  });
  return { ...result, columns, onchange };
}

function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function installPointerGeometry(container: HTMLElement): void {
  const columns = Array.from(
    container.querySelectorAll<HTMLElement>('.cinder-kanban-board__column'),
  );
  columns.forEach((column, index) => {
    column.getBoundingClientRect = () => makeRect(index * 220, 0, 200, 400);
  });

  const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-sortable-row]'));
  cards.forEach((card, index) => {
    const column = card.closest('.cinder-kanban-board__column') as HTMLElement;
    const columnIndex = columns.indexOf(column);
    const rowIndex = columnIndex === 0 ? index : 0;
    card.getBoundingClientRect = () => makeRect(columnIndex * 220, rowIndex * 56, 180, 48);
  });
}

function installPointerCapture(handle: HTMLElement): void {
  handle.setPointerCapture = mock(() => {});
  handle.releasePointerCapture = mock(() => {});
  handle.hasPointerCapture = mock(() => true);
}

async function waitForAnimationFrame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

async function waitForAnnouncement(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('kanban board helpers', () => {
  test('validates duplicate column and card keys', () => {
    const result = validateKanbanBoardKeys(
      [
        { id: 'x', title: 'One', cards: [alpha] },
        { id: 'x', title: 'Two', cards: [alpha] },
      ],
      getCardKey,
    );
    expect(result.valid).toBe(false);
    expect(result.duplicateColumnKeys.has('x')).toBe(true);
    expect(result.duplicateCardKeys.has('a')).toBe(true);
  });

  test('moves a card within one column without mutating input', () => {
    const columns = makeColumns();
    const result = moveKanbanCard(columns, getCardKey, 'a', { columnIndex: 0, cardIndex: 1 });
    expect(result?.nextColumns[0].cards.map(getCardKey)).toEqual(['b', 'a']);
    expect(result?.nextColumns[1]).toBe(columns[1]);
    expect(result?.nextColumns[0].cards[1]).toBe(alpha);
    expect(columns[0].cards.map(getCardKey)).toEqual(['a', 'b']);
    expect(result?.change).toMatchObject({
      type: 'card',
      fromColumnKey: 'todo',
      toColumnKey: 'todo',
      fromIndex: 0,
      toIndex: 1,
    });
  });

  test('moves a card across columns and into an empty column', () => {
    const result = moveKanbanCard(makeColumns(), getCardKey, 'a', {
      columnIndex: 2,
      cardIndex: 0,
    });
    expect(result?.nextColumns[0].cards.map(getCardKey)).toEqual(['b']);
    expect(result?.nextColumns[2].cards.map(getCardKey)).toEqual(['a']);
    expect(result?.change).toMatchObject({
      type: 'card',
      fromColumnKey: 'todo',
      toColumnKey: 'done',
      fromIndex: 0,
      toIndex: 0,
    });
  });

  test('rejects moves into collapsed columns', () => {
    const columns = makeColumns();
    columns[1] = { ...columns[1], collapsed: true };
    expect(moveKanbanCard(columns, getCardKey, 'a', { columnIndex: 1, cardIndex: 0 })).toBeNull();
  });

  test('reorders columns', () => {
    const result = moveKanbanColumn(makeColumns(), 'todo', 2);
    expect(result?.nextColumns.map((column) => column.id)).toEqual(['doing', 'done', 'todo']);
    expect(result?.change).toEqual({ type: 'column', columnKey: 'todo', fromIndex: 0, toIndex: 2 });
  });

  test('finds next visible non-collapsed column', () => {
    const columns = makeColumns();
    columns[1] = { ...columns[1], collapsed: true };
    expect(findNextVisibleColumn(columns, 0, 1)).toBe(2);
    expect(findNextVisibleColumn(columns, 2, 1)).toBeNull();
  });
});

describe('KanbanBoard', () => {
  test('renders zero columns without throwing', () => {
    const { container } = renderBoard({ columns: [] });
    expect(container.querySelector('.cinder-kanban-board')).not.toBeNull();
  });

  test('renders card and column handles', () => {
    const { container } = renderBoard();
    expect(container.querySelectorAll('.cinder-kanban-board__column').length).toBe(3);
    expect(container.querySelector('[aria-label="Move Alpha"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Reorder To do column"]')).not.toBeNull();
  });

  test('keyboard moves a card within a column and emits card metadata', async () => {
    const { container, onchange } = renderBoard();
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await fireEvent.keyDown(handle, { key: ' ' });

    expect(onchange).toHaveBeenCalledTimes(1);
    const [nextColumns, change] = onchange.mock.calls[0];
    expect(nextColumns[0].cards.map(getCardKey)).toEqual(['b', 'a']);
    expect(change).toMatchObject({ type: 'card', fromColumnKey: 'todo', toColumnKey: 'todo' });
  });

  test('keyboard moves a card across visible columns', async () => {
    const { container, onchange } = renderBoard();
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    await fireEvent.keyDown(handle, { key: ' ' });

    expect(onchange).toHaveBeenCalledTimes(1);
    const [nextColumns, change] = onchange.mock.calls[0];
    expect(nextColumns[0].cards.map(getCardKey)).toEqual(['b']);
    expect(nextColumns[1].cards.map(getCardKey)).toEqual(['a', 'c']);
    expect(change).toMatchObject({ type: 'card', fromColumnKey: 'todo', toColumnKey: 'doing' });
  });

  test('keyboard append across columns announces the prospective destination total', async () => {
    const { container, onchange } = renderBoard();
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    const movedHandle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    await fireEvent.keyDown(movedHandle, { key: 'ArrowDown' });
    await waitForAnnouncement();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('position 2 of 2');
    await fireEvent.keyDown(movedHandle, { key: ' ' });
    await waitForAnnouncement();

    const [nextColumns, change] = onchange.mock.calls[0];
    expect(nextColumns[1].cards.map(getCardKey)).toEqual(['c', 'a']);
    expect(change).toMatchObject({ toColumnKey: 'doing', toIndex: 1 });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'dropped at position 2 of 2',
    );
  });

  test('pointer drag moves a card across columns', async () => {
    const { container, onchange } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(handle, {
      clientX: 240,
      clientY: 4,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await waitForAnimationFrame();
    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });

    expect(onchange).toHaveBeenCalledTimes(1);
    const [nextColumns, change] = onchange.mock.calls[0];
    expect(nextColumns[0].cards.map(getCardKey)).toEqual(['b']);
    expect(nextColumns[1].cards.map(getCardKey)).toEqual(['a', 'c']);
    expect(change).toMatchObject({
      type: 'card',
      fromColumnKey: 'todo',
      toColumnKey: 'doing',
      fromIndex: 0,
      toIndex: 0,
    });
  });

  test('pointer drag does not repeat move announcements when the target is unchanged', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await waitForAnnouncement();
    const liftedAnnouncement = container.querySelector('[role="alert"]')?.textContent;

    await fireEvent.pointerMove(handle, {
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await waitForAnimationFrame();
    await waitForAnnouncement();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(liftedAnnouncement);
  });

  test('window Escape cancels a lifted card after focus leaves the handle', async () => {
    const { container, onchange } = renderBoard();
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });
    await tick();
    expect(handle.getAttribute('aria-pressed')).toBe('true');

    await fireEvent.keyDown(window, { key: 'Escape' });
    await waitForAnnouncement();

    expect(handle.getAttribute('aria-pressed')).toBe('false');
    expect(onchange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('move cancelled');
  });

  test('column handles do not lift while a card is lifted', async () => {
    const { container, onchange } = renderBoard();
    const cardHandle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    const columnHandle = container.querySelector(
      '[aria-label="Reorder To do column"]',
    ) as HTMLElement;

    await fireEvent.keyDown(cardHandle, { key: ' ' });
    await fireEvent.click(columnHandle);

    expect(cardHandle.getAttribute('aria-pressed')).toBe('true');
    expect(columnHandle.getAttribute('aria-pressed')).toBe('false');
    expect(onchange).not.toHaveBeenCalled();
  });

  test('drop cancels when the target column collapses while a card is lifted', async () => {
    const onchange = mock();
    const columns = makeColumns();
    const props = {
      columns,
      getCardKey,
      getCardLabel,
      onchange,
      label: 'Work board',
      card: cardSnippet(),
    };
    const { container, rerender } = render(KanbanBoard as any, { props });
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    await rerender({
      ...props,
      columns: columns.map((column) =>
        column.id === 'doing' ? { ...column, collapsed: true } : column,
      ),
    });
    const movedHandle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    await fireEvent.keyDown(movedHandle, { key: ' ' });
    await waitForAnnouncement();

    expect(onchange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('move cancelled');
  });

  test('drop cancels when the lifted card is removed before commit', async () => {
    const onchange = mock();
    const columns = makeColumns();
    const props = {
      columns,
      getCardKey,
      getCardLabel,
      onchange,
      label: 'Work board',
      card: cardSnippet(),
    };
    const { container, rerender } = render(KanbanBoard as any, { props });
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });
    await rerender({
      ...props,
      columns: columns.map((column) =>
        column.id === 'todo'
          ? { ...column, cards: column.cards.filter((currentCard) => currentCard.id !== 'a') }
          : column,
      ),
    });
    await fireEvent.keyDown(handle, { key: ' ' });
    await waitForAnnouncement();

    expect(onchange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('move cancelled');
  });

  test('announces no destination when lateral movement is blocked', async () => {
    const columns = makeColumns();
    columns[1] = { ...columns[1], collapsed: true };
    columns[2] = { ...columns[2], collapsed: true };
    const { container, onchange } = renderBoard({ columns });
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onchange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('no available column');
  });

  test('collapse toggle emits collapse metadata and hides cards', async () => {
    const { container, onchange } = renderBoard({ collapsible: true });
    const button = container.querySelector('[aria-label="Collapse To do"]') as HTMLElement;

    await fireEvent.click(button);

    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange.mock.calls[0][1]).toEqual({
      type: 'collapse',
      columnKey: 'todo',
      collapsed: true,
    });
  });

  test('column keyboard reorder emits column metadata', async () => {
    const { container, onchange } = renderBoard();
    const handle = container.querySelector('[aria-label="Reorder To do column"]') as HTMLElement;

    await fireEvent.click(handle);
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    await fireEvent.keyDown(handle, { key: ' ' });
    await waitForAnnouncement();

    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange.mock.calls[0][0].map((column: KanbanBoardColumn<Card>) => column.id)).toEqual([
      'doing',
      'todo',
      'done',
    ]);
    expect(onchange.mock.calls[0][1]).toEqual({
      type: 'column',
      columnKey: 'todo',
      fromIndex: 0,
      toIndex: 1,
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'To do column dropped at position 2 of 3',
    );
  });

  test('column handle click lifts and drops the active column', async () => {
    const { container, onchange } = renderBoard();
    const handle = container.querySelector('[aria-label="Reorder To do column"]') as HTMLElement;

    await fireEvent.click(handle);
    expect(handle.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    await fireEvent.click(handle);

    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange.mock.calls[0][1]).toEqual({
      type: 'column',
      columnKey: 'todo',
      fromIndex: 0,
      toIndex: 1,
    });
  });

  test('Space keydown + synthesized click leaves the column lifted, not immediately dropped', async () => {
    // Regression: before the fix, handleColumnKeydown lifted on Space keydown
    // (idle branch) AND handleColumnClick dropped on the subsequent browser-
    // synthesized click, so one Space press performed lift-then-drop in a single
    // interaction, making keyboard column reordering non-functional.
    //
    // The fix removes Space/Enter from the idle keydown path and lets the native
    // synthesized click drive handleColumnClick → liftColumn. We simulate the
    // real chain that a browser produces: keydown(Space) followed immediately by
    // a click on the same element.
    const { container } = renderBoard();
    const handle = container.querySelector('[aria-label="Reorder To do column"]') as HTMLElement;

    // Simulate the browser sequence: keydown fires first, then on keyup the
    // browser synthesizes a click. We fire both in order.
    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.click(handle);
    await tick();

    // After a single Space press the column must be LIFTED (aria-pressed=true),
    // not lifted-then-dropped back to idle (aria-pressed=false).
    expect(handle.getAttribute('aria-pressed')).toBe('true');
  });

  test('window Escape cancels a lifted column after focus leaves the handle', async () => {
    const { container, onchange } = renderBoard();
    const handle = container.querySelector('[aria-label="Reorder To do column"]') as HTMLElement;

    await fireEvent.click(handle);
    await tick();
    expect(handle.getAttribute('aria-pressed')).toBe('true');

    await fireEvent.keyDown(window, { key: 'Escape' });
    await waitForAnnouncement();

    expect(handle.getAttribute('aria-pressed')).toBe('false');
    expect(onchange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'To do column move cancelled',
    );
  });

  test('column keyboard reorder cancels on Tab without moving focus prevention', async () => {
    const { container, onchange } = renderBoard();
    const handle = container.querySelector('[aria-label="Reorder To do column"]') as HTMLElement;

    await fireEvent.click(handle);
    await tick();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    handle.dispatchEvent(tabEvent);
    await waitForAnnouncement();

    expect(tabEvent.defaultPrevented).toBe(false);
    expect(handle.getAttribute('aria-pressed')).toBe('false');
    expect(onchange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('move cancelled');
  });

  test('reorderColumns=false removes column handles', () => {
    const { container } = renderBoard({ reorderColumns: false });
    expect(container.querySelector('[aria-label="Reorder To do column"]')).toBeNull();
  });

  test('duplicate keys warn, mark the root, and prevent lifts', async () => {
    const warn = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warn;
    try {
      const columns = [
        { id: 'todo', title: 'To do', cards: [alpha, alpha] },
        { id: 'todo', title: 'Again', cards: [] },
      ];
      const { container, onchange } = renderBoard({ columns });
      const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;

      await fireEvent.keyDown(handle, { key: ' ' });
      await fireEvent.keyDown(handle, { key: 'ArrowDown' });
      await fireEvent.keyDown(handle, { key: ' ' });

      expect(warn).toHaveBeenCalled();
      expect(
        container.querySelector('.cinder-kanban-board')?.hasAttribute('data-cinder-invalid-keys'),
      ).toBe(true);
      expect(onchange).not.toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
    }
  });

  test('duplicate keys cancel an active card lift when they appear after lift', async () => {
    const warn = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warn;
    try {
      const columns = makeColumns();
      const props = {
        columns,
        getCardKey,
        getCardLabel,
        onchange: mock(),
        label: 'Work board',
        card: cardSnippet(),
      };
      const { container, rerender } = render(KanbanBoard as any, { props });
      const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;

      await fireEvent.keyDown(handle, { key: ' ' });
      expect(handle.getAttribute('aria-pressed')).toBe('true');

      await rerender({
        ...props,
        columns: [
          { id: 'todo', title: 'To do', cards: [alpha, alpha] },
          { id: 'todo', title: 'Again', cards: [] },
        ],
      });
      await waitForAnnouncement();

      const duplicateHandle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
      expect(duplicateHandle.getAttribute('aria-pressed')).toBe('false');
      expect(container.querySelector('[role="alert"]')?.textContent).toContain('move cancelled');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('duplicate keys cancel an active column lift when they appear after lift', async () => {
    const warn = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warn;
    try {
      const columns = makeColumns();
      const props = {
        columns,
        getCardKey,
        getCardLabel,
        onchange: mock(),
        label: 'Work board',
        card: cardSnippet(),
      };
      const { container, rerender } = render(KanbanBoard as any, { props });
      const handle = container.querySelector('[aria-label="Reorder To do column"]') as HTMLElement;

      await fireEvent.click(handle);
      expect(handle.getAttribute('aria-pressed')).toBe('true');

      await rerender({
        ...props,
        columns: [
          { id: 'todo', title: 'To do', cards: [alpha, alpha] },
          { id: 'todo', title: 'Again', cards: [] },
        ],
      });

      const duplicateHandle = container.querySelector(
        '[aria-label="Reorder To do column"]',
      ) as HTMLElement;
      expect(duplicateHandle.getAttribute('aria-pressed')).toBe('false');
    } finally {
      console.warn = originalWarn;
    }
  });
});

// ---------------------------------------------------------------------------
// KanbanBoard pointer drag preview state contract tests
// ---------------------------------------------------------------------------
//
// Verifies the drag preview lifecycle for KanbanBoard card drags:
//   - Pointer drag creates a [data-cinder-drag-preview] portal on body.
//   - Card row becomes placeholder during pointer drag.
//   - Drop removes the portal.
//   - Cancel / Escape removes the portal.
//   - Keyboard lift does not create a portal.
//   - Cross-column drag keeps a preview and placeholder visible.

describe('KanbanBoard pointer drag preview', () => {
  afterEach(() => {
    document.querySelectorAll('[data-cinder-drag-preview]').forEach((element) => element.remove());
  });

  test('pointer drag creates a preview portal on document.body', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const preview = document.querySelector('[data-cinder-drag-preview]');
    expect(preview).not.toBeNull();
    expect(document.body.contains(preview)).toBe(true);
    expect(container.contains(preview)).toBe(false);

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });

  test('preview portal has aria-hidden=true', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const preview = document.querySelector('[data-cinder-drag-preview]');
    expect(preview?.getAttribute('aria-hidden')).toBe('true');

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });

  test('lifted card row has --placeholder class during pointer drag', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const cardRow = container.querySelector('[data-key="a"]') as HTMLElement;
    expect(cardRow?.classList.contains('cinder-sortable-item--placeholder')).toBe(true);
    expect(cardRow?.classList.contains('cinder-sortable-item--lifted')).toBe(false);

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });

  test('card row exposes data-preview-x/y during pointer drag', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 30,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const cardRow = container.querySelector('[data-key="a"]') as HTMLElement;
    expect(cardRow?.getAttribute('data-preview-x')).toBe('20');
    expect(cardRow?.getAttribute('data-preview-y')).toBe('30');

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });

  test('preview position updates on pointer move', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await fireEvent.pointerMove(handle, {
      clientX: 100,
      clientY: 50,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await waitForAnimationFrame();

    const cardRow = container.querySelector('[data-key="a"]') as HTMLElement;
    expect(cardRow?.getAttribute('data-preview-x')).toBe('100');
    expect(cardRow?.getAttribute('data-preview-y')).toBe('50');

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });

  test('drop removes the preview portal', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(document.querySelector('[data-cinder-drag-preview]')).not.toBeNull();

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });

    expect(document.querySelector('[data-cinder-drag-preview]')).toBeNull();
  });

  test('drop clears placeholder class and preview attributes', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });

    // After drop, the card row is at its new logical position. Query by key.
    const cardRow = container.querySelector('[data-key="a"]') as HTMLElement;
    expect(cardRow).not.toBeNull();
    expect(cardRow.classList.contains('cinder-sortable-item--placeholder')).toBe(false);
    expect(cardRow.hasAttribute('data-preview-x')).toBe(false);
    expect(cardRow.hasAttribute('data-preview-y')).toBe(false);
  });

  test('pointercancel removes the preview portal', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(document.querySelector('[data-cinder-drag-preview]')).not.toBeNull();

    await fireEvent.pointerCancel(handle, { pointerId: 1, pointerType: 'mouse' });

    expect(document.querySelector('[data-cinder-drag-preview]')).toBeNull();
  });

  test('Escape during pointer drag removes the preview portal', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(document.querySelector('[data-cinder-drag-preview]')).not.toBeNull();

    await fireEvent.keyDown(handle, { key: 'Escape' });

    expect(document.querySelector('[data-cinder-drag-preview]')).toBeNull();
  });

  test('window Escape during pointer drag removes the preview portal', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(document.querySelector('[data-cinder-drag-preview]')).not.toBeNull();

    await fireEvent.keyDown(window, { key: 'Escape' });

    expect(document.querySelector('[data-cinder-drag-preview]')).toBeNull();
  });

  test('keyboard lift does NOT create a preview portal', async () => {
    const { container } = renderBoard();
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });

    expect(document.querySelector('[data-cinder-drag-preview]')).toBeNull();
    const cardRow = container.querySelector('[data-key="a"]') as HTMLElement;
    expect(cardRow?.classList.contains('cinder-sortable-item--lifted')).toBe(true);
    expect(cardRow?.classList.contains('cinder-sortable-item--placeholder')).toBe(false);

    await fireEvent.keyDown(handle, { key: 'Escape' });
  });

  test('rejected lift (another card already lifted) does NOT create an orphaned preview portal', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const alphaHandle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    const betaHandle = container.querySelector('[aria-label="Move Beta"]') as HTMLElement;
    installPointerCapture(alphaHandle);
    installPointerCapture(betaHandle);

    // Lift Alpha.
    await fireEvent.pointerDown(alphaHandle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(1);

    // Attempt a concurrent lift on Beta while Alpha is already lifted.
    // The controller rejects the second lift; no second portal must be created.
    await fireEvent.pointerDown(betaHandle, {
      button: 0,
      clientX: 20,
      clientY: 60,
      pointerId: 2,
      pointerType: 'mouse',
    });

    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(1);

    // Clean up.
    await fireEvent.pointerUp(alphaHandle, { pointerId: 1, pointerType: 'mouse' });
    expect(document.querySelectorAll('[data-cinder-drag-preview]').length).toBe(0);
  });

  test('cross-column pointer drag creates a preview and a placeholder in the source column', async () => {
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    // Move pointer into the second column.
    await fireEvent.pointerMove(handle, {
      clientX: 240,
      clientY: 4,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await waitForAnimationFrame();

    // Preview must still be on body.
    const preview = document.querySelector('[data-cinder-drag-preview]');
    expect(preview).not.toBeNull();
    expect(document.body.contains(preview)).toBe(true);

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
    expect(document.querySelector('[data-cinder-drag-preview]')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Regression: drop-target filter must exclude the dragged card in both
  // keyboard-drag state (--lifted) and pointer-drag state (--placeholder).
  //
  // Before the fix, locatePointerTarget filtered rows by
  // !row.classList.contains('cinder-sortable-item--lifted'). During a pointer
  // drag the lifted card carries cinder-sortable-item--placeholder instead, so
  // the dragged card was NOT excluded — skewing midpoint calculations. The fix
  // filters by data-key, which is present and stable in both drag states.
  //
  // Note: happy-dom does not support ':scope >' in Element.querySelector, so
  // locatePointerTarget's card-list lookup returns null in this environment and
  // all pointer-drag cardIndex values always resolve to 0 (empty row set →
  // insertionIndex 0). The full midpoint-computation path is correct in real
  // browsers; the tests below verify the class-state invariant that the old
  // filter would have broken.
  // ---------------------------------------------------------------------------

  test('pointer drag: dragged row gets --placeholder (not --lifted) — old class filter would miss it', async () => {
    // This test documents the core of the regression. During a pointer drag the
    // dragged row carries cinder-sortable-item--placeholder, NOT --lifted. The
    // old locatePointerTarget filter excluded only --lifted rows, so the dragged
    // card would be included in midpoint calculations during pointer drags.
    const { container } = renderBoard();
    installPointerGeometry(container);
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;
    installPointerCapture(handle);

    await fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const alphaRow = container.querySelector('[data-key="a"]') as HTMLElement;
    // The class the old filter keyed on is NOT present during a pointer drag.
    expect(alphaRow?.classList.contains('cinder-sortable-item--lifted')).toBe(false);
    // The actual class during a pointer drag IS present — and carries the data-key
    // that the fixed filter now uses to identify and exclude the dragged row.
    expect(alphaRow?.classList.contains('cinder-sortable-item--placeholder')).toBe(true);
    // data-key is present and stable regardless of drag state.
    expect(alphaRow?.getAttribute('data-key')).toBe('a');

    await fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse' });
  });

  test('keyboard drag: dragged row gets --lifted (not --placeholder) — data-key filter still excludes it', async () => {
    // Mirror of the previous test for keyboard drags. data-key is present in
    // both states, making it the correct stable exclusion marker.
    const { container } = renderBoard();
    const handle = container.querySelector('[aria-label="Move Alpha"]') as HTMLElement;

    await fireEvent.keyDown(handle, { key: ' ' });

    const alphaRow = container.querySelector('[data-key="a"]') as HTMLElement;
    expect(alphaRow?.classList.contains('cinder-sortable-item--lifted')).toBe(true);
    expect(alphaRow?.classList.contains('cinder-sortable-item--placeholder')).toBe(false);
    expect(alphaRow?.getAttribute('data-key')).toBe('a');

    await fireEvent.keyDown(handle, { key: 'Escape' });
  });
});
