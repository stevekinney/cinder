import { moveKanbanColumn, toggleKanbanColumn } from './kanban-board-helpers.ts';
import type { KanbanBoardChange, KanbanBoardColumn } from './kanban-board.types.ts';

type CardControllerPhase = 'idle' | 'lifted';

type KanbanBoardColumnReorderOptions<Card> = {
  getColumns: () => KanbanBoardColumn<Card>[];
  getReorderColumns: () => boolean;
  getInvalidKeys: () => boolean;
  announce: (message: string) => void;
  onchange: (nextColumns: KanbanBoardColumn<Card>[], change: KanbanBoardChange) => void;
};

/**
 * Owns column lift/drop/collapse state and the click/keyboard handlers that
 * drive it. Deliberately does not read `cardController` directly — column
 * reordering and card dragging are separate interaction modes, and the one
 * place they need to know about each other (don't let a column reorder start
 * while a card is lifted) is expressed by having the caller pass the card
 * controller's current phase into each entry point instead.
 */
export class KanbanBoardColumnReorder<Card> {
  liftedKey = $state<string | number | null>(null);
  targetIndex = $state<number | null>(null);

  readonly #options: KanbanBoardColumnReorderOptions<Card>;

  constructor(options: KanbanBoardColumnReorderOptions<Card>) {
    this.#options = options;
  }

  cancelColumnLift(columnTitle: string | undefined = undefined): void {
    this.liftedKey = null;
    this.targetIndex = null;
    if (columnTitle) this.#options.announce(`${columnTitle} column move cancelled.`);
  }

  toggleColumn(column: KanbanBoardColumn<Card>): void {
    const result = toggleKanbanColumn(this.#options.getColumns(), column.id);
    if (!result) return;
    this.#options.announce(
      `${column.title} ${result.change.type === 'collapse' && result.change.collapsed ? 'collapsed' : 'expanded'}.`,
    );
    this.#options.onchange(result.nextColumns, result.change);
  }

  liftColumn(
    column: KanbanBoardColumn<Card>,
    columnIndex: number,
    cardControllerPhase: CardControllerPhase,
  ): void {
    if (cardControllerPhase === 'lifted') return;
    this.liftedKey = column.id;
    this.targetIndex = columnIndex;
    this.#options.announce(
      `${column.title} column lifted, position ${columnIndex + 1} of ${this.#options.getColumns().length}.`,
    );
  }

  dropColumn(column: KanbanBoardColumn<Card>, targetIndex: number): void {
    const columns = this.#options.getColumns();
    const result = moveKanbanColumn(columns, column.id, targetIndex);
    this.liftedKey = null;
    this.targetIndex = null;
    this.#options.announce(
      `${column.title} column dropped at position ${targetIndex + 1} of ${columns.length}.`,
    );
    if (result) this.#options.onchange(result.nextColumns, result.change);
  }

  handleColumnClick(
    column: KanbanBoardColumn<Card>,
    columnIndex: number,
    cardControllerPhase: CardControllerPhase,
  ): void {
    if (
      !this.#options.getReorderColumns() ||
      this.#options.getInvalidKeys() ||
      cardControllerPhase === 'lifted'
    )
      return;
    if (this.liftedKey === null) {
      this.liftColumn(column, columnIndex, cardControllerPhase);
      return;
    }
    if (this.liftedKey === column.id) {
      this.dropColumn(column, this.targetIndex ?? columnIndex);
    }
  }

  handleColumnKeydown(
    event: KeyboardEvent,
    column: KanbanBoardColumn<Card>,
    columnIndex: number,
    cardControllerPhase: CardControllerPhase,
  ): void {
    if (
      !this.#options.getReorderColumns() ||
      this.#options.getInvalidKeys() ||
      cardControllerPhase === 'lifted'
    )
      return;
    if (this.liftedKey === null) {
      // Space/Enter in the idle state: do nothing here. The native button will
      // synthesize a click on Space/Enter keyup, which handleColumnClick will
      // handle to liftColumn. Handling Space/Enter in both keydown and the
      // subsequent synthesized click caused an immediate lift-then-drop.
      return;
    }
    if (this.liftedKey !== column.id) return;
    const columns = this.#options.getColumns();
    const currentTarget = this.targetIndex ?? columnIndex;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelColumnLift(column.title);
      return;
    }
    if (event.key === 'Tab') {
      this.cancelColumnLift(column.title);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      // Prevent the default action so the browser does not synthesize a click
      // event on keyup — for Space, preventDefault() on keydown suppresses the
      // synthetic keyup-click, so handleColumnClick never fires after the column
      // is already dropped and this.liftedKey is null again.
      event.preventDefault();
      this.dropColumn(column, currentTarget);
      return;
    }
    const nextIndex =
      event.key === 'ArrowLeft'
        ? currentTarget - 1
        : event.key === 'ArrowRight'
          ? currentTarget + 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? columns.length - 1
              : currentTarget;
    if (nextIndex !== currentTarget) {
      event.preventDefault();
      this.targetIndex = Math.max(0, Math.min(nextIndex, columns.length - 1));
      this.#options.announce(
        `${column.title} column moved to position ${(this.targetIndex ?? 0) + 1} of ${columns.length}.`,
      );
    }
  }
}
