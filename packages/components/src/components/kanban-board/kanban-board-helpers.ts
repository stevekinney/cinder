import { reorder } from '../../utilities/sortable-controller.svelte.ts';
import type {
  KanbanBoardCardMoveChange,
  KanbanBoardChange,
  KanbanBoardColumn,
  KanbanBoardColumnMoveChange,
} from './kanban-board.types.ts';

export type KeyValidationResult = {
  valid: boolean;
  duplicateColumnKeys: Set<string | number>;
  duplicateCardKeys: Set<string | number>;
};

export type LocatedCard<Card> = {
  card: Card;
  cardKey: string | number;
  column: KanbanBoardColumn<Card>;
  columnIndex: number;
  cardIndex: number;
};

export type CardMoveTarget = {
  columnIndex: number;
  cardIndex: number;
};

export function validateKanbanBoardKeys<Card>(
  columns: KanbanBoardColumn<Card>[],
  getCardKey: (card: Card) => string | number,
): KeyValidationResult {
  const columnKeys = new Set<string | number>();
  const duplicateColumnKeys = new Set<string | number>();
  const cardKeys = new Set<string | number>();
  const duplicateCardKeys = new Set<string | number>();

  for (const column of columns) {
    if (columnKeys.has(column.id)) duplicateColumnKeys.add(column.id);
    columnKeys.add(column.id);

    for (const card of column.cards) {
      const cardKey = getCardKey(card);
      if (cardKeys.has(cardKey)) duplicateCardKeys.add(cardKey);
      cardKeys.add(cardKey);
    }
  }

  return {
    valid: duplicateColumnKeys.size === 0 && duplicateCardKeys.size === 0,
    duplicateColumnKeys,
    duplicateCardKeys,
  };
}

export function findCard<Card>(
  columns: KanbanBoardColumn<Card>[],
  getCardKey: (card: Card) => string | number,
  cardKey: string | number,
): LocatedCard<Card> | null {
  for (const [columnIndex, column] of columns.entries()) {
    const cardIndex = column.cards.findIndex((card) => getCardKey(card) === cardKey);
    const card = column.cards[cardIndex];
    if (cardIndex >= 0 && card !== undefined) {
      return {
        card,
        cardKey,
        column,
        columnIndex,
        cardIndex,
      };
    }
  }
  return null;
}

/**
 * Index every card by its key in a single O(total-cards) pass so callers can
 * resolve a card's original column/index in O(1). Calling `findCard` once per
 * card during render is O(N²); building this map once and looking up by key
 * collapses that to O(N). On duplicate keys the first occurrence wins, matching
 * the left-to-right scan order of `findCard`.
 */
export function buildCardLocationMap<Card>(
  columns: KanbanBoardColumn<Card>[],
  getCardKey: (card: Card) => string | number,
): Map<string | number, LocatedCard<Card>> {
  const locations = new Map<string | number, LocatedCard<Card>>();
  for (const [columnIndex, column] of columns.entries()) {
    column.cards.forEach((card, cardIndex) => {
      const cardKey = getCardKey(card);
      if (locations.has(cardKey)) return;
      locations.set(cardKey, { card, cardKey, column, columnIndex, cardIndex });
    });
  }
  return locations;
}

export function moveKanbanCard<Card>(
  columns: KanbanBoardColumn<Card>[],
  getCardKey: (card: Card) => string | number,
  cardKey: string | number,
  target: CardMoveTarget,
): { nextColumns: KanbanBoardColumn<Card>[]; change: KanbanBoardCardMoveChange } | null {
  const located = findCard(columns, getCardKey, cardKey);
  if (!located) return null;

  const targetColumn = columns[target.columnIndex];
  if (!targetColumn || targetColumn.collapsed) return null;

  const fromColumn = located.column;
  const targetLength =
    target.columnIndex === located.columnIndex
      ? fromColumn.cards.length
      : targetColumn.cards.length;
  const toIndex = Math.max(0, Math.min(target.cardIndex, Math.max(0, targetLength - 1)));
  const crossColumnToIndex = Math.max(0, Math.min(target.cardIndex, targetColumn.cards.length));

  if (target.columnIndex === located.columnIndex) {
    if (located.cardIndex === toIndex) return null;
    const nextColumns = columns.map((column, index) =>
      index === located.columnIndex
        ? { ...column, cards: reorder(column.cards, located.cardIndex, toIndex) }
        : column,
    );
    return {
      nextColumns,
      change: {
        type: 'card',
        cardKey,
        fromColumnKey: fromColumn.id,
        toColumnKey: fromColumn.id,
        fromIndex: located.cardIndex,
        toIndex,
      },
    };
  }

  const nextColumns = columns.map((column, index) => {
    if (index === located.columnIndex) {
      return {
        ...column,
        cards: column.cards.filter((_, cardIndex) => cardIndex !== located.cardIndex),
      };
    }
    if (index === target.columnIndex) {
      const cards = [...column.cards];
      cards.splice(crossColumnToIndex, 0, located.card);
      return { ...column, cards };
    }
    return column;
  });

  return {
    nextColumns,
    change: {
      type: 'card',
      cardKey,
      fromColumnKey: fromColumn.id,
      toColumnKey: targetColumn.id,
      fromIndex: located.cardIndex,
      toIndex: crossColumnToIndex,
    },
  };
}

export function moveKanbanColumn<Card>(
  columns: KanbanBoardColumn<Card>[],
  columnKey: string | number,
  toIndex: number,
): { nextColumns: KanbanBoardColumn<Card>[]; change: KanbanBoardColumnMoveChange } | null {
  const fromIndex = columns.findIndex((column) => column.id === columnKey);
  if (fromIndex < 0) return null;
  const clamped = Math.max(0, Math.min(toIndex, columns.length - 1));
  if (fromIndex === clamped) return null;
  return {
    nextColumns: reorder(columns, fromIndex, clamped),
    change: { type: 'column', columnKey, fromIndex, toIndex: clamped },
  };
}

export function toggleKanbanColumn<Card>(
  columns: KanbanBoardColumn<Card>[],
  columnKey: string | number,
): { nextColumns: KanbanBoardColumn<Card>[]; change: KanbanBoardChange } | null {
  const columnIndex = columns.findIndex((column) => column.id === columnKey);
  const column = columns[columnIndex];
  if (columnIndex < 0 || column === undefined) return null;
  const collapsed = !column.collapsed;
  return {
    nextColumns: columns.map((current, index) =>
      index === columnIndex ? { ...current, collapsed } : current,
    ),
    change: { type: 'collapse', columnKey, collapsed },
  };
}

export function findNextVisibleColumn<Card>(
  columns: KanbanBoardColumn<Card>[],
  fromColumnIndex: number,
  direction: -1 | 1,
): number | null {
  for (
    let index = fromColumnIndex + direction;
    index >= 0 && index < columns.length;
    index += direction
  ) {
    if (!columns[index]?.collapsed) return index;
  }
  return null;
}

export function getColumnCardListElement(columnElement: HTMLElement): HTMLElement | null {
  return (
    Array.from(columnElement.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.classList.contains('cinder-kanban-board__cards'),
    ) ?? null
  );
}

export function sortableRowMatchesKey(row: HTMLElement, key: string | number): boolean {
  return (
    row.getAttribute('data-key') === String(key) && row.getAttribute('data-key-type') === typeof key
  );
}

export function getLiftedRowElement(
  columnsElement: HTMLElement | null,
  liftedKey: string | number | null,
): HTMLElement | null {
  if (!columnsElement || liftedKey === null) return null;
  return (
    Array.from(columnsElement.querySelectorAll<HTMLElement>('[data-sortable-row]')).find((row) =>
      sortableRowMatchesKey(row, liftedKey),
    ) ?? null
  );
}

export function getLiftedRowBlockSize(
  columnsElement: HTMLElement | null,
  liftedKey: string | number | null,
): number {
  return getLiftedRowElement(columnsElement, liftedKey)?.getBoundingClientRect().height ?? 0;
}

export function getColumnDropZoneBottom(cardList: HTMLElement, liftedRowBlockSize: number): number {
  return cardList.getBoundingClientRect().bottom + liftedRowBlockSize;
}

/**
 * Pure DOM hit-testing: resolves which column and card-insertion-index a
 * pointer position maps to. Parameterized rather than closing over component
 * locals so it can be unit tested and reused without a live component
 * instance.
 */
export function locatePointerTarget<Card>(args: {
  columnsElement: HTMLElement | null;
  columns: KanbanBoardColumn<Card>[];
  liftedKey: string | number | null;
  pointerX: number;
  pointerY: number;
}): CardMoveTarget | null {
  const { columnsElement, columns, liftedKey, pointerX, pointerY } = args;
  if (!columnsElement) return null;
  const liftedRowBlockSize = getLiftedRowBlockSize(columnsElement, liftedKey);
  const columnElements = Array.from(columnsElement.children).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && element.classList.contains('cinder-kanban-board__column'),
  );
  const columnIndex = columnElements.findIndex((element) => {
    const rect = element.getBoundingClientRect();
    const cardList = getColumnCardListElement(element);
    if (!cardList) return false;
    return (
      pointerX >= rect.left &&
      pointerX <= rect.right &&
      pointerY >= rect.top &&
      pointerY <= getColumnDropZoneBottom(cardList, liftedRowBlockSize)
    );
  });
  if (columnIndex < 0 || columns[columnIndex]?.collapsed) return null;
  const columnElement = columnElements[columnIndex];
  if (!columnElement) return null;
  const cardList = getColumnCardListElement(columnElement);
  // Exclude the dragged card by its stable data-key attribute so the filter
  // works regardless of whether the card is in the keyboard-drag state
  // (cinder-sortable-item--lifted) or the pointer-drag state
  // (cinder-sortable-item--placeholder). Both states carry the same data-key.
  const draggedKey = liftedKey;
  const rows = Array.from(cardList?.children ?? []).filter(
    (row): row is HTMLElement =>
      row instanceof HTMLElement &&
      row.hasAttribute('data-sortable-row') &&
      (draggedKey === null || !sortableRowMatchesKey(row, draggedKey)),
  );
  const insertionIndex = rows.filter((row) => {
    const rect = row.getBoundingClientRect();
    return rect.top + rect.height / 2 < pointerY;
  }).length;
  return { columnIndex, cardIndex: insertionIndex };
}
