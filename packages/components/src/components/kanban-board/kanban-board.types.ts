import type { Snippet } from 'svelte';

export type KanbanBoardColumn<Card> = {
  id: string | number;
  title: string;
  cards: Card[];
  collapsed?: boolean;
};

export type KanbanBoardCardMoveChange = {
  type: 'card';
  cardKey: string | number;
  fromColumnKey: string | number;
  toColumnKey: string | number;
  fromIndex: number;
  toIndex: number;
};

export type KanbanBoardColumnMoveChange = {
  type: 'column';
  columnKey: string | number;
  fromIndex: number;
  toIndex: number;
};

export type KanbanBoardCollapseChange = {
  type: 'collapse';
  columnKey: string | number;
  collapsed: boolean;
};

export type KanbanBoardChange =
  | KanbanBoardCardMoveChange
  | KanbanBoardColumnMoveChange
  | KanbanBoardCollapseChange;

export type KanbanBoardCardContext<Card> = {
  column: KanbanBoardColumn<Card>;
  columnIndex: number;
  cardIndex: number;
  visualIndex: number;
  totalCards: number;
  isLifted: boolean;
  isDropTarget: boolean;
};

export type KanbanBoardColumnContext<Card> = {
  column: KanbanBoardColumn<Card>;
  columnIndex: number;
  totalColumns: number;
  isLifted: boolean;
  isDropTarget: boolean;
  collapsed: boolean;
  canCollapse: boolean;
  canReorder: boolean;
};

export type KanbanBoardProps<Card> = {
  columns: KanbanBoardColumn<Card>[];
  getCardKey: (card: Card) => string | number;
  getCardLabel: (card: Card, column: KanbanBoardColumn<Card>, index: number) => string;
  onchange: (nextColumns: KanbanBoardColumn<Card>[], change: KanbanBoardChange) => void;
  card: Snippet<[Card, KanbanBoardCardContext<Card>]>;
  columnHeader?: Snippet<[KanbanBoardColumn<Card>, KanbanBoardColumnContext<Card>]>;
  columnActions?: Snippet<[KanbanBoardColumn<Card>, KanbanBoardColumnContext<Card>]>;
  emptyColumn?: Snippet<[KanbanBoardColumn<Card>]>;
  /** Accessible label applied to the board's `<section>` root via `aria-label`. */
  label?: string;
  /** When true, each column renders a collapse/expand button that toggles its card list. */
  collapsible?: boolean;
  /** When true (default), columns can be reordered by dragging or keyboard. Set to false to make column order fixed. */
  reorderColumns?: boolean;
  /** Additional class merged onto the `.cinder-kanban-board` root element. */
  class?: string;
};
