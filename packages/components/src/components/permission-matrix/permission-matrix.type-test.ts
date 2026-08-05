import type {
  PermissionMatrixAxisItem,
  PermissionMatrixCellState,
  PermissionMatrixProps,
} from './permission-matrix.types.ts';

const scopeRows = [
  { id: 'billing-read', label: 'billing:read', scopeKey: 'billing' },
  { id: 'billing-write', label: 'billing:write', scopeKey: 'billing' },
] satisfies Array<{ id: string; label: string; scopeKey: string }>;

const columns = [
  { id: 'read', label: 'Read' },
  { id: 'write', label: 'Write' },
] satisfies PermissionMatrixAxisItem[];

const _valid: PermissionMatrixProps<{ id: string; label: string; scopeKey: string }> = {
  label: 'Scope permissions',
  rows: scopeRows,
  columns,
  getCellState: (row, column): PermissionMatrixCellState => {
    return row.scopeKey === 'billing' && column.id === 'read' ? 'granted' : 'denied';
  },
  onCellClick: (row, column, state) => {
    void row.scopeKey;
    void column.id;
    void state;
  },
};

const _invalid: PermissionMatrixProps = {
  label: 'Scope permissions',
  rows: columns,
  columns,
  getCellState: (row) => {
    // @ts-expect-error - default PermissionMatrixAxisItem row has no scopeKey field
    void row.scopeKey;
    return 'granted';
  },
};

void _valid;
void _invalid;
