<script lang="ts">
  import PermissionMatrix from './permission-matrix.svelte';
  import type {
    PermissionMatrixAxisItem,
    PermissionMatrixCellState,
  } from './permission-matrix.types.ts';

  type ScopeRow = { id: string; label: string; scopeKey: string };

  let scopeRows = $state<ScopeRow[]>([
    { id: 'billing-read', label: 'billing:read', scopeKey: 'billing' },
    { id: 'billing-write', label: 'billing:write', scopeKey: 'billing' },
  ]);

  const columns: PermissionMatrixAxisItem[] = [
    { id: 'read', label: 'Read' },
    { id: 'write', label: 'Write' },
  ];

  function getScopedCellState(
    row: ScopeRow,
    column: PermissionMatrixAxisItem,
  ): PermissionMatrixCellState {
    return row.scopeKey === 'billing' && column.id === 'read' ? 'granted' : 'denied';
  }

  const plainRows: PermissionMatrixAxisItem[] = [
    { id: 'users', label: 'Users' },
    { id: 'billing', label: 'Billing' },
  ];

  function getPlainCellState(): PermissionMatrixCellState {
    return 'not-applicable';
  }
</script>

<PermissionMatrix
  label="Reactive scope permissions"
  rows={scopeRows}
  {columns}
  getCellState={getScopedCellState}
/>

<PermissionMatrix
  label="Literal scope permissions"
  rows={[
    { id: 'runs-admin', label: 'runs:admin', scopeKey: 'runs' },
    { id: 'runs-read', label: 'runs:read', scopeKey: 'runs' },
  ]}
  {columns}
  getCellState={(row, column) =>
    row.scopeKey === 'runs' && column.id === 'write' ? 'granted' : 'denied'}
/>

<PermissionMatrix
  label="Default axis item shape"
  rows={plainRows}
  columns={plainRows}
  getCellState={getPlainCellState}
/>
