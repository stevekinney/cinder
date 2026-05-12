import { createContext } from 'svelte';

export type SortableAnnouncements = {
  lifted: (itemLabel: string, position: number, total: number) => string;
  moved: (itemLabel: string, position: number, total: number) => string;
  dropped: (itemLabel: string, position: number, total: number) => string;
  cancelled: (itemLabel: string) => string;
};

export type SortableReorderChange = {
  itemKey: string | number;
  /** Index of the lifted item in `items` immediately before the drop. */
  fromIndex: number;
  /** Index where the item is placed after the drop. */
  toIndex: number;
};

export type SortableItemContext = {
  /** True when this row is currently lifted. */
  isLifted: boolean;
  /** True when this row would receive the drop. */
  isDropTarget: boolean;
  /** The visual index this row currently occupies. */
  visualIndex: number;
  /** Total rows in the list. */
  total: number;
};

/** Shape of the command bag passed through context from SortableList to SortableItem. */
export type SortableContextValue = {
  controller: SortableController<unknown>;
  commitDrop: (itemKey: string | number, itemLabel: string) => void;
  cancel: (itemLabel: string) => void;
  lift: (key: string | number, fromIndex: number, itemLabel: string, total: number) => void;
  move: (toIndex: number, itemLabel: string, total: number) => void;
};

export const [getSortableContext, setSortableContext] = createContext<SortableContextValue>();

const defaultAnnouncements: SortableAnnouncements = {
  lifted: (itemLabel, position, total) =>
    `${itemLabel}, lifted. Current position ${position} of ${total}. Use arrow keys to move. Space to drop, Escape to cancel.`,
  moved: (itemLabel, position, total) => `${itemLabel}, moved to position ${position} of ${total}.`,
  dropped: (itemLabel, position, total) =>
    `${itemLabel}, dropped at position ${position} of ${total}.`,
  cancelled: (itemLabel) => `Reorder cancelled. ${itemLabel} returned to original position.`,
};

/**
 * Pure state machine for sortable list reordering.
 *
 * Does not own onreorder — SortableList inspects the return value of drop() and
 * invokes the consumer callback itself. Does not import useAnnouncer — it receives
 * an announce callback at construction time.
 */
export class SortableController<Item> {
  phase = $state<'idle' | 'lifted'>('idle');
  liftedKey = $state<string | number | null>(null);
  liftedLabel = $state<string>('');
  liftedFrom = $state(0);
  liftedTo = $state(0);

  readonly #announce: (message: string) => void;
  readonly #announcements: SortableAnnouncements;

  constructor(options: {
    announce: (message: string) => void;
    announcements?: Partial<SortableAnnouncements>;
  }) {
    this.#announce = options.announce;
    this.#announcements = { ...defaultAnnouncements, ...options.announcements };
  }

  lift(key: string | number, fromIndex: number, itemLabel: string, total: number): void {
    this.phase = 'lifted';
    this.liftedKey = key;
    this.liftedLabel = itemLabel;
    this.liftedFrom = fromIndex;
    this.liftedTo = fromIndex;
    this.#announce(this.#announcements.lifted(itemLabel, fromIndex + 1, total));
  }

  move(toIndex: number, itemLabel: string, total: number): void {
    if (this.phase !== 'lifted') return;
    const clamped = Math.max(0, Math.min(total - 1, toIndex));
    if (clamped === this.liftedTo) return;
    this.liftedTo = clamped;
    this.#announce(this.#announcements.moved(itemLabel, clamped + 1, total));
  }

  /**
   * Attempt a drop. Returns { nextItems, change } if order changed, null otherwise.
   * Always announces dropped regardless.
   * Caller (SortableList) is responsible for calling onreorder when non-null is returned.
   */
  drop(
    items: Item[],
    itemLabel: string,
  ): { nextItems: Item[]; change: SortableReorderChange } | null {
    if (this.phase !== 'lifted' || this.liftedKey === null) return null;

    const fromIndex = this.liftedFrom;
    const toIndex = this.liftedTo;
    const itemKey = this.liftedKey;

    this.#announce(this.#announcements.dropped(itemLabel, toIndex + 1, items.length));
    this.#reset();

    if (fromIndex === toIndex) return null;

    // Bounds check: liftedFrom should always be valid (reconcileLiftedKey keeps it current),
    // but guard defensively so a stale index cannot corrupt the output array.
    if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
      return null;
    }

    const nextItems = reorder(items, fromIndex, toIndex);
    return { nextItems, change: { itemKey, fromIndex, toIndex } };
  }

  cancel(itemLabel?: string): void {
    if (this.phase !== 'lifted') return;
    this.#announce(this.#announcements.cancelled(itemLabel ?? this.liftedLabel));
    this.#reset();
  }

  /**
   * Called by SortableList in a $effect when items changes during a lift.
   * If the lifted key is gone, auto-cancels using the stored liftedLabel.
   * If it moved, updates liftedFrom.
   */
  reconcileLiftedKey(items: Item[], getKey: (item: Item) => string | number): void {
    if (this.phase !== 'lifted' || this.liftedKey === null) return;

    const currentIndex = items.findIndex((it) => getKey(it) === this.liftedKey);

    if (currentIndex < 0) {
      // Lifted item was removed by parent — announce with the stored label
      this.#announce(this.#announcements.cancelled(this.liftedLabel));
      this.#reset();
      return;
    }

    // Always clamp liftedTo — items may have been removed from the end of the list
    // even when the lifted item's own index hasn't changed.
    this.liftedTo = Math.max(0, Math.min(items.length - 1, this.liftedTo));
    if (currentIndex !== this.liftedFrom) {
      this.liftedFrom = currentIndex;
    }
  }

  #reset(): void {
    this.phase = 'idle';
    this.liftedKey = null;
    this.liftedLabel = '';
    this.liftedFrom = 0;
    this.liftedTo = 0;
  }
}

/**
 * Reorder helper: moves the item at fromIndex to toIndex.
 * Returns a new array; does not mutate the input.
 */
export function reorder<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...items];
  const removed = result.splice(fromIndex, 1)[0] as T;
  result.splice(toIndex, 0, removed);
  return result;
}
