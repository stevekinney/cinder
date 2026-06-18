import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type PermissionMatrixCellState = 'granted' | 'denied' | 'not-applicable';

export type PermissionMatrixAxisItem = {
  /** Stable identity returned from cell click callbacks. */
  id: string;
  /** Text label rendered in the row or column header. */
  label: string;
};

export type PermissionMatrixStateLabels = Partial<Record<PermissionMatrixCellState, string>>;

export type PermissionMatrixProps<
  TRow extends PermissionMatrixAxisItem = PermissionMatrixAxisItem,
  TColumn extends PermissionMatrixAxisItem = PermissionMatrixAxisItem,
> = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Accessible label for the matrix. */
  label: string;
  /** Optional description rendered above the matrix. */
  description?: string;
  /** Row definitions, usually authorization scopes. */
  rows: readonly TRow[];
  /** Column definitions, usually operations. */
  columns: readonly TColumn[];
  /** Resolves the discrete state for one row and column intersection. */
  getCellState: (row: TRow, column: TColumn) => PermissionMatrixCellState;
  /** Called when a matrix cell is activated. */
  onCellClick?: (row: TRow, column: TColumn, state: PermissionMatrixCellState) => void;
  /** Accessible and visible labels for the built-in states. */
  stateLabels?: PermissionMatrixStateLabels;
  /** Whether the matrix is in a loading state. */
  loading?: boolean;
  /** Custom class applied to the root element. */
  class?: string;
  /** Snippet rendered when rows or columns are empty. */
  empty?: Snippet;
  /** Snippet rendered while the matrix is loading. */
  loadingContent?: Snippet;
};

export type PermissionMatrixSchemaProps = {
  /** Accessible label for the matrix. */
  label: string;
  /** Optional description rendered above the matrix. */
  description?: string;
  /** Row definitions, usually authorization scopes. */
  rows: PermissionMatrixAxisItem[];
  /** Column definitions, usually operations. */
  columns: PermissionMatrixAxisItem[];
  /** Resolves the discrete state for one row and column intersection. */
  getCellState: (
    row: PermissionMatrixAxisItem,
    column: PermissionMatrixAxisItem,
  ) => PermissionMatrixCellState;
  /** Called when a matrix cell is activated. */
  onCellClick?: (
    row: PermissionMatrixAxisItem,
    column: PermissionMatrixAxisItem,
    state: PermissionMatrixCellState,
  ) => void;
  /** Accessible and visible labels for the built-in states. */
  stateLabels?: PermissionMatrixStateLabels;
  /** Whether the matrix is in a loading state. Default `false`. */
  loading?: boolean;
  /** Custom class applied to the root element. */
  class?: string;
};
