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
    if (cardIndex >= 0) {
      return {
        card: column.cards[cardIndex] as Card,
        cardKey,
        column,
        columnIndex,
        cardIndex,
      };
    }
  }
  return null;
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
  if (columnIndex < 0) return null;
  const column = columns[columnIndex] as KanbanBoardColumn<Card>;
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
