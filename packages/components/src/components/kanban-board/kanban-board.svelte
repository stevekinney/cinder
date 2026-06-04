<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Controlled multi-column board for reordering cards within and across workflow columns with keyboard, pointer, and live-region feedback.
   * @tag board
   * @tag kanban
   * @tag drag
   * @tag reorder
   * @useWhen Presenting a workflow board where users move cards between ordered columns.
   * @useWhen Consumers own card rendering and need cinder to manage reorder affordances and change metadata.
   * @avoidWhen Showing a single ordered list — use sortable-list instead.
   * @avoidWhen Sorting by computed fields rather than direct manual placement.
   * @related sortable-list, grid-list, data-list
   */
  export type {
    KanbanBoardCardContext,
    KanbanBoardChange,
    KanbanBoardColumn,
    KanbanBoardColumnContext,
    KanbanBoardProps,
  } from './kanban-board.types.ts';
</script>

<script lang="ts" generics="Card">
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import {
    SortableController,
    setSortableContext,
  } from '../../utilities/sortable-controller.svelte.ts';
  import { useAnnouncer } from '../../utilities/use-announcer.svelte.ts';
  import SortableItem from '../_sortable-item.svelte';
  import {
    buildCardLocationMap,
    findCard,
    findNextVisibleColumn,
    moveKanbanCard,
    moveKanbanColumn,
    toggleKanbanColumn,
    validateKanbanBoardKeys,
    type CardMoveTarget,
  } from './kanban-board-helpers.ts';
  import type {
    KanbanBoardCardContext,
    KanbanBoardColumn,
    KanbanBoardColumnContext,
    KanbanBoardProps,
  } from './kanban-board.types.ts';

  let {
    columns,
    getCardKey,
    getCardLabel,
    onchange,
    card,
    columnHeader,
    columnActions,
    emptyColumn,
    label,
    collapsible = false,
    reorderColumns = true,
    class: className,
  }: KanbanBoardProps<Card> = $props();

  const announcer = useAnnouncer({ clearDelay: 5000 });
  const cardController = new SortableController<Card>({
    announce: (message) => announcer.announce(message),
    announcements: {
      lifted: (itemLabel, position, total) =>
        `${itemLabel} lifted from position ${position} of ${total}. Use arrow keys to move, Space to drop, Escape to cancel.`,
      moved: (itemLabel, position, total) =>
        `${itemLabel} moved to position ${position} of ${total}.`,
      dropped: (itemLabel, position, total) =>
        `${itemLabel} dropped at position ${position} of ${total}.`,
      cancelled: (itemLabel) => `${itemLabel} move cancelled.`,
    },
  });

  const baseId = $props.id();
  const instructionsId = `${baseId}-instructions`;
  const columnInstructionsId = `${baseId}-column-instructions`;
  let columnsElement = $state<HTMLElement | null>(null);
  let cardTarget = $state<CardMoveTarget | null>(null);
  let pointerColumnIndex = $state<number | null>(null);
  let columnLiftedKey = $state<string | number | null>(null);
  let columnTargetIndex = $state<number | null>(null);
  let lastInvalidKeyWarning = '';

  const keyValidation = $derived(validateKanbanBoardKeys(columns, getCardKey));
  const invalidKeys = $derived(!keyValidation.valid);

  // Index cards by key once per render so the card loop can resolve each card's
  // original column/index in O(1) instead of calling findCard per-card (O(N²)).
  // Built from the source `columns` (original positions) — getCardLabel must stay
  // stable on the source position while visualColumns shows the preview reorder.
  const cardLocations = $derived(buildCardLocationMap(columns, getCardKey));

  const visualColumns = $derived.by(() => {
    if (cardController.phase !== 'lifted' || cardController.liftedKey === null || !cardTarget) {
      return columns;
    }
    const located = findCard(columns, getCardKey, cardController.liftedKey);
    if (!located || located.columnIndex !== cardTarget.columnIndex) return columns;
    return (
      moveKanbanCard(columns, getCardKey, cardController.liftedKey, cardTarget)?.nextColumns ??
      columns
    );
  });

  $effect(() => {
    if (!invalidKeys) {
      lastInvalidKeyWarning = '';
      return;
    }
    const duplicateColumns = [...keyValidation.duplicateColumnKeys].join(', ');
    const duplicateCards = [...keyValidation.duplicateCardKeys].join(', ');
    const warningSignature = `${duplicateColumns}|${duplicateCards}`;
    if (warningSignature === lastInvalidKeyWarning) return;
    lastInvalidKeyWarning = warningSignature;
    devWarn(
      `[cinder-kanban-board] duplicate keys disable reordering. Duplicate columns: ${duplicateColumns || 'none'}. Duplicate cards: ${duplicateCards || 'none'}.`,
    );
  });

  $effect(() => {
    if (!invalidKeys) return;
    if (cardController.phase === 'lifted') cancelCardLift();
    if (columnLiftedKey !== null) cancelColumnLift();
  });

  $effect(() => {
    columns.forEach((column) => column.cards.forEach((currentCard) => getCardKey(currentCard)));
    if (cardController.phase !== 'lifted' || cardController.liftedKey === null) return;
    const located = findCard(columns, getCardKey, cardController.liftedKey);
    if (!located) {
      cardController.cancel();
      cardTarget = null;
      return;
    }
    if (!cardTarget) {
      cardTarget = { columnIndex: located.columnIndex, cardIndex: located.cardIndex };
    }
  });

  function getColumnLabel(column: KanbanBoardColumn<Card>): string {
    return column.title;
  }

  function getCardCount(column: KanbanBoardColumn<Card>): number {
    return column.collapsed ? 0 : column.cards.length;
  }

  function makeCardContext(
    column: KanbanBoardColumn<Card>,
    columnIndex: number,
    cardIndex: number,
    isLifted: boolean,
    isDropTarget: boolean,
  ): KanbanBoardCardContext<Card> {
    return {
      column,
      columnIndex,
      cardIndex,
      visualIndex: cardIndex,
      totalCards: column.cards.length,
      isLifted,
      isDropTarget,
    };
  }

  function makeColumnContext(
    column: KanbanBoardColumn<Card>,
    columnIndex: number,
  ): KanbanBoardColumnContext<Card> {
    return {
      column,
      columnIndex,
      totalColumns: columns.length,
      isLifted: columnLiftedKey === column.id,
      isDropTarget: columnTargetIndex === columnIndex,
      collapsed: Boolean(column.collapsed),
      canCollapse: collapsible,
      canReorder: reorderColumns && !invalidKeys,
    };
  }

  function locatePointerTarget(pointerX: number, pointerY: number): CardMoveTarget | null {
    if (!columnsElement) return null;
    const columnElements = Array.from(columnsElement.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element.classList.contains('cinder-kanban-board__column'),
    );
    const columnIndex = columnElements.findIndex((element) => {
      const rect = element.getBoundingClientRect();
      return (
        pointerX >= rect.left &&
        pointerX <= rect.right &&
        pointerY >= rect.top &&
        pointerY <= rect.bottom
      );
    });
    if (columnIndex < 0 || columns[columnIndex]?.collapsed) return null;
    const columnElement = columnElements[columnIndex];
    if (!columnElement) return null;
    const cardList = columnElement.querySelector<HTMLElement>(
      ':scope > .cinder-kanban-board__cards',
    );
    // Exclude the dragged card by its stable data-key attribute so the filter
    // works regardless of whether the card is in the keyboard-drag state
    // (cinder-sortable-item--lifted) or the pointer-drag state
    // (cinder-sortable-item--placeholder). Both states carry the same data-key.
    const draggedKey = cardController.liftedKey;
    const rows = Array.from(cardList?.children ?? []).filter(
      (row): row is HTMLElement =>
        row instanceof HTMLElement &&
        row.hasAttribute('data-sortable-row') &&
        row.getAttribute('data-key') !== String(draggedKey),
    );
    const insertionIndex = rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top + rect.height / 2 < pointerY;
    }).length;
    return { columnIndex, cardIndex: insertionIndex };
  }

  function getDestinationTotal(target: CardMoveTarget, itemKey: string | number | null): number {
    const column = columns[target.columnIndex];
    if (!column) return 1;
    const located = itemKey === null ? null : findCard(columns, getCardKey, itemKey);
    const sameColumn = located?.columnIndex === target.columnIndex;
    return Math.max(1, sameColumn ? column.cards.length : column.cards.length + 1);
  }

  function announceTarget(itemLabel: string): void {
    if (!cardTarget) return;
    const column = columns[cardTarget.columnIndex];
    if (!column) return;
    const total = getDestinationTotal(cardTarget, cardController.liftedKey);
    announcer.announce(
      `${itemLabel} moved to ${column.title}, position ${cardTarget.cardIndex + 1} of ${total}.`,
    );
  }

  setSortableContext({
    get controller() {
      return cardController as SortableController<unknown>;
    },
    commitDrop(itemKey, itemLabel) {
      if (invalidKeys || !cardTarget) {
        cancelCardLift(itemLabel);
        return;
      }
      const destinationColumn = columns[cardTarget.columnIndex];
      if (!destinationColumn || destinationColumn.collapsed) {
        cancelCardLift(itemLabel);
        return;
      }
      const located = findCard(columns, getCardKey, itemKey);
      if (!located) {
        cancelCardLift(itemLabel);
        return;
      }
      const dropTotal = getDestinationTotal(cardTarget, itemKey);
      const result = moveKanbanCard(columns, getCardKey, itemKey, cardTarget);
      cardController.completeDrop(itemLabel, dropTotal);
      cardTarget = null;
      pointerColumnIndex = null;
      if (result) onchange(result.nextColumns, result.change);
    },
    cancel(itemLabel) {
      cardController.cancel(itemLabel);
      cardTarget = null;
      pointerColumnIndex = null;
    },
    lift(key, fromIndex, itemLabel, total) {
      if (invalidKeys || columnLiftedKey !== null) return;
      const located = findCard(columns, getCardKey, key);
      if (!located || located.column.collapsed) return;
      cardTarget = { columnIndex: located.columnIndex, cardIndex: located.cardIndex };
      cardController.lift(key, fromIndex, itemLabel, total);
    },
    move(toIndex, itemLabel, _total) {
      if (!cardTarget) return;
      const previousTarget = cardTarget;
      const targetColumnIndex = pointerColumnIndex ?? cardTarget.columnIndex;
      const column = columns[targetColumnIndex];
      if (!column || column.collapsed) return;
      const located =
        cardController.liftedKey === null
          ? null
          : findCard(columns, getCardKey, cardController.liftedKey);
      const allowAppend = pointerColumnIndex !== null || located?.columnIndex !== targetColumnIndex;
      const maxCardIndex = allowAppend
        ? getCardCount(column)
        : Math.max(0, getCardCount(column) - 1);
      const cardIndex = Math.max(0, Math.min(toIndex, maxCardIndex));
      cardTarget = { columnIndex: targetColumnIndex, cardIndex };
      const destinationTotal = getDestinationTotal(cardTarget, cardController.liftedKey);
      const targetChanged =
        previousTarget.columnIndex !== cardTarget.columnIndex ||
        previousTarget.cardIndex !== cardTarget.cardIndex;
      cardController.move(cardIndex, itemLabel, destinationTotal, { announce: false });
      if (targetChanged) announceTarget(itemLabel);
      pointerColumnIndex = null;
    },
    getPointerTarget({ pointerX, pointerY }) {
      const target = locatePointerTarget(pointerX, pointerY);
      if (!target) return null;
      pointerColumnIndex = target.columnIndex;
      const column = columns[target.columnIndex];
      return {
        index: target.cardIndex,
        total: Math.max(1, getCardCount(column as KanbanBoardColumn<Card>)),
      };
    },
    handleLiftedKeydown({ event, itemLabel }) {
      if (!cardTarget || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return false;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextColumnIndex = findNextVisibleColumn(columns, cardTarget.columnIndex, direction);
      if (nextColumnIndex === null) {
        announcer.announce(`${itemLabel} has no available column in that direction.`);
        return true;
      }
      const nextColumn = columns[nextColumnIndex] as KanbanBoardColumn<Card>;
      cardTarget = {
        columnIndex: nextColumnIndex,
        cardIndex: Math.max(0, Math.min(cardTarget.cardIndex, nextColumn.cards.length)),
      };
      const destinationTotal = getDestinationTotal(cardTarget, cardController.liftedKey);
      cardController.move(cardTarget.cardIndex, itemLabel, destinationTotal, { announce: false });
      announceTarget(itemLabel);
      return true;
    },
  });

  function cancelCardLift(itemLabel?: string): void {
    cardController.cancel(itemLabel);
    cardTarget = null;
    pointerColumnIndex = null;
  }

  function cancelColumnLift(columnTitle?: string): void {
    columnLiftedKey = null;
    columnTargetIndex = null;
    if (columnTitle) announcer.announce(`${columnTitle} column move cancelled.`);
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (cardController.phase === 'lifted' && event.key === 'Escape') {
      event.preventDefault();
      cancelCardLift();
      return;
    }
    if (columnLiftedKey !== null && event.key === 'Escape') {
      event.preventDefault();
      const column = columns.find((currentColumn) => currentColumn.id === columnLiftedKey);
      cancelColumnLift(column?.title);
    }
  }

  function toggleColumn(column: KanbanBoardColumn<Card>): void {
    const result = toggleKanbanColumn(columns, column.id);
    if (!result) return;
    announcer.announce(
      `${column.title} ${result.change.type === 'collapse' && result.change.collapsed ? 'collapsed' : 'expanded'}.`,
    );
    onchange(result.nextColumns, result.change);
  }

  function liftColumn(column: KanbanBoardColumn<Card>, columnIndex: number): void {
    if (cardController.phase === 'lifted') return;
    columnLiftedKey = column.id;
    columnTargetIndex = columnIndex;
    announcer.announce(
      `${column.title} column lifted, position ${columnIndex + 1} of ${columns.length}.`,
    );
  }

  function dropColumn(column: KanbanBoardColumn<Card>, targetIndex: number): void {
    const result = moveKanbanColumn(columns, column.id, targetIndex);
    columnLiftedKey = null;
    columnTargetIndex = null;
    announcer.announce(
      `${column.title} column dropped at position ${targetIndex + 1} of ${columns.length}.`,
    );
    if (result) onchange(result.nextColumns, result.change);
  }

  function handleColumnClick(column: KanbanBoardColumn<Card>, columnIndex: number): void {
    if (!reorderColumns || invalidKeys || cardController.phase === 'lifted') return;
    if (columnLiftedKey === null) {
      liftColumn(column, columnIndex);
      return;
    }
    if (columnLiftedKey === column.id) {
      dropColumn(column, columnTargetIndex ?? columnIndex);
    }
  }

  function handleColumnKeydown(
    event: KeyboardEvent,
    column: KanbanBoardColumn<Card>,
    columnIndex: number,
  ): void {
    if (!reorderColumns || invalidKeys || cardController.phase === 'lifted') return;
    if (columnLiftedKey === null) {
      // Space/Enter in the idle state: do nothing here. The native button will
      // synthesize a click on Space/Enter keyup, which handleColumnClick will
      // handle to liftColumn. Handling Space/Enter in both keydown and the
      // subsequent synthesized click caused an immediate lift-then-drop.
      return;
    }
    if (columnLiftedKey !== column.id) return;
    const currentTarget = columnTargetIndex ?? columnIndex;
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelColumnLift(column.title);
      return;
    }
    if (event.key === 'Tab') {
      cancelColumnLift(column.title);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      // Prevent the default action so the browser does not synthesize a click
      // event on keyup — for Space, preventDefault() on keydown suppresses the
      // synthetic keyup-click, so handleColumnClick never fires after the column
      // is already dropped and columnLiftedKey is null again.
      event.preventDefault();
      dropColumn(column, currentTarget);
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
      columnTargetIndex = Math.max(0, Math.min(nextIndex, columns.length - 1));
      announcer.announce(
        `${column.title} column moved to position ${(columnTargetIndex ?? 0) + 1} of ${columns.length}.`,
      );
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<section
  class={classNames('cinder-kanban-board', className)}
  aria-label={label}
  data-cinder-invalid-keys={invalidKeys ? '' : undefined}
>
  <p id={instructionsId} class="cinder-sr-only">
    Press Space to lift a card, arrow keys to move it, Space to drop, and Escape to cancel.
  </p>
  <p id={columnInstructionsId} class="cinder-sr-only">
    Press Space to lift a column, Left and Right arrows to move it, Space to drop, and Escape to
    cancel.
  </p>

  <div bind:this={columnsElement} class="cinder-kanban-board__columns" role="list">
    {#each visualColumns as column, columnIndex (invalidKeys ? `${column.id}-${columnIndex}` : column.id)}
      {@const columnContext = makeColumnContext(column, columnIndex)}
      <section
        class="cinder-kanban-board__column"
        role="listitem"
        aria-label={getColumnLabel(column)}
        data-cinder-collapsed={column.collapsed ? '' : undefined}
      >
        <header class="cinder-kanban-board__column-header">
          {#if reorderColumns}
            <button
              type="button"
              class="cinder-kanban-board__column-handle"
              aria-label={`Reorder ${column.title} column`}
              aria-pressed={columnLiftedKey === column.id}
              aria-describedby={columnInstructionsId}
              disabled={invalidKeys}
              onclick={() => handleColumnClick(column, columnIndex)}
              onkeydown={(event) => handleColumnKeydown(event, column, columnIndex)}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M2 4h12v1.5H2zM2 7.25h12v1.5H2zM2 10.5h12v1.5H2z" />
              </svg>
            </button>
          {/if}
          <div class="cinder-kanban-board__column-title">
            {#if columnHeader}
              {@render columnHeader(column, columnContext)}
            {:else}
              {column.title}
            {/if}
          </div>
          {#if columnActions}
            <div class="cinder-kanban-board__column-actions">
              {@render columnActions(column, columnContext)}
            </div>
          {/if}
          {#if collapsible}
            <button
              type="button"
              class="cinder-kanban-board__collapse"
              aria-label={`${column.collapsed ? 'Expand' : 'Collapse'} ${column.title}`}
              aria-expanded={!column.collapsed}
              onclick={() => toggleColumn(column)}
            >
              {column.collapsed ? '+' : '-'}
            </button>
          {/if}
        </header>

        {#if !column.collapsed}
          <ul
            class="cinder-kanban-board__cards cinder-sortable-list"
            role="list"
            aria-label={`${column.title} cards`}
          >
            {#each column.cards as currentCard, cardIndex (invalidKeys ? `${getCardKey(currentCard)}-${cardIndex}` : getCardKey(currentCard))}
              {@const cardKey = getCardKey(currentCard)}
              {@const original = cardLocations.get(cardKey) ?? null}
              {@const itemLabel = getCardLabel(
                currentCard,
                original?.column ?? column,
                original?.cardIndex ?? cardIndex,
              )}
              {@const isLifted =
                cardController.phase === 'lifted' && cardController.liftedKey === cardKey}
              {@const isDropTarget = Boolean(
                cardTarget &&
                cardTarget.columnIndex === columnIndex &&
                cardTarget.cardIndex === cardIndex,
              )}
              <SortableItem
                item={currentCard}
                itemKey={cardKey}
                index={cardIndex}
                {itemLabel}
                formatHandleLabel={(name) => `Move ${name}`}
                {instructionsId}
                total={Math.max(1, column.cards.length)}
                class="cinder-kanban-board__card"
              >
                {#snippet children()}
                  <div class="cinder-kanban-board__card-content">
                    {@render card(
                      currentCard,
                      makeCardContext(column, columnIndex, cardIndex, isLifted, isDropTarget),
                    )}
                  </div>
                {/snippet}
              </SortableItem>
            {/each}
            {#if column.cards.length === 0}
              <li class="cinder-kanban-board__empty">
                {#if emptyColumn}
                  {@render emptyColumn(column)}
                {:else}
                  No cards
                {/if}
              </li>
            {/if}
          </ul>
        {/if}
      </section>
    {/each}
  </div>
</section>

<div role="alert" aria-atomic="true" class="cinder-sr-only">
  {announcer.message}
</div>
