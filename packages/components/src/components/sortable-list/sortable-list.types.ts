import type { Snippet } from 'svelte';
export type {
  SortableAnnouncements,
  SortableItemContext,
  SortableReorderChange,
} from '../../utilities/sortable-controller.svelte.ts';
/** Props for the SortableList component. */
export type SortableListProps<Item> = {
  /** The list of items to render. */
  items: Item[];
  /** Returns a stable key for each item. Must not change across reorders. */
  getKey: (item: Item) => string | number;
  /**
   * Returns an accessible label for each item (e.g., "Buy milk").
   * The second argument is the item's original index in the `items` array
   * (not its current visual position during a drag).
   * Used in handle aria-label and announcements.
   */
  getItemLabel: (item: Item, originalIndex: number) => string;
  /** Optional formatter for the drag handle's accessible name. Default: "Reorder {itemLabel}". */
  formatHandleLabel?: (itemLabel: string) => string;
  /** Optional snippet rendered inside the drag-handle button. Receives { pressed, label }. */
  handle?: Snippet<[{ pressed: boolean; label: string }]>;
  /** Fires with the full reordered array and change metadata on drop. */
  onreorder: (
    nextItems: Item[],
    change: import('../../utilities/sortable-controller.svelte.ts').SortableReorderChange,
  ) => void;
  /** Optional overrides for announcement strings. */
  announcements?: Partial<
    import('../../utilities/sortable-controller.svelte.ts').SortableAnnouncements
  >;
  /** Row content snippet. Receives the item and a per-row context. */
  children: Snippet<
    [Item, import('../../utilities/sortable-controller.svelte.ts').SortableItemContext]
  >;
  /** Accessible name for the list (applied as aria-label on the list root). */
  label?: string;
  class?: string;
};
