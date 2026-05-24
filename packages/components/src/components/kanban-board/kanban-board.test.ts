// @ts-nocheck — component tests exercise generic snippets and DOM APIs.
/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

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

    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    await fireEvent.keyDown(handle, { key: ' ' });

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
});
