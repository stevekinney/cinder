import type { HTMLAttributes } from 'svelte/elements';

/** Item rendered by TransferList. */
export type TransferListItem = {
  /** Stable item identifier stored in `value`. */
  id: string;
  /** Visible option label. */
  label: string;
  /** Prevents selecting or transferring the item. */
  disabled?: boolean;
};

/** Props for the TransferList component. */
export type TransferListProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
  /** Full item pool. The component never mutates this array. */
  items: TransferListItem[];
  /** IDs currently assigned to the right-side selected list. Supports `bind:value`. */
  value?: string[];
  /**
   * Accessible and visible label for the left list.
   * @default "Available"
   */
  leftLabel?: string;
  /**
   * Accessible and visible label for the right list.
   * @default "Selected"
   */
  rightLabel?: string;
  /** Called with the next right-side value after a transfer. */
  onChange?: (value: string[]) => void;
  /** Custom class merged with `.cinder-transfer-list`. */
  class?: string;
};
