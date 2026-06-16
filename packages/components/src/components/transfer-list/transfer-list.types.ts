import type { HTMLAttributes } from 'svelte/elements';

/**
 * @schemaObject
 */
export type TransferListItem = {
  /** Unique stable item identifier stored in `value`. */
  id: string;
  /** Visible option label. */
  label: string;
  /** Prevents selecting or transferring the item from the available list. Already-selected disabled items remain removable. */
  disabled?: boolean;
};

/** Props for the TransferList component. */
export type TransferListProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
  /** Full item pool. Item IDs must be unique; duplicate IDs after the first are ignored. The component never mutates this array. */
  items: TransferListItem[];
  /** Unique IDs currently assigned to the right-side selected list. Supports `bind:value`. Unknown IDs are ignored and dropped on the next transfer. */
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

/** Schema-facing props for TransferList. */
export interface TransferListSchemaProps {
  /** Full item pool. Item IDs must be unique; duplicate IDs after the first are ignored. The component never mutates this array. */
  items: TransferListItem[];
  /** Unique IDs currently assigned to the right-side selected list. Supports `bind:value`. Unknown IDs are ignored and dropped on the next transfer. */
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
  /** Custom class merged with `.cinder-transfer-list`. */
  class?: string;
}
