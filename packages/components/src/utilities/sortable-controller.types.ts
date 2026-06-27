import type { SortableController } from './sortable-controller.svelte.ts';

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
  getPointerTarget?: (input: {
    activeKey: string | number;
    pointerX: number;
    pointerY: number;
    itemLabel: string;
  }) => { index: number; total: number } | null;
  handleLiftedKeydown?: (input: {
    event: KeyboardEvent;
    itemKey: string | number;
    itemLabel: string;
    index: number;
    total: number;
  }) => boolean;
};
