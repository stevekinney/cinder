<script lang="ts" module>
  export const title = 'Scope matrix';
  export const description =
    'A permission matrix showing which authorization scopes grant catalog operations.';
</script>

<script lang="ts">
  import { PermissionMatrix } from '@lostgradient/cinder/permission-matrix';
  import type {
    PermissionMatrixAxisItem,
    PermissionMatrixCellState,
  } from '@lostgradient/cinder/permission-matrix';

  const rows = [
    { id: 'workflows-admin', label: 'workflows:admin' },
    { id: 'workflows-read', label: 'workflows:read' },
    { id: 'runs-admin', label: 'runs:admin' },
    { id: 'runs-read', label: 'runs:read' },
  ];

  const columns = [
    { id: 'cancel', label: 'cancel' },
    { id: 'retry', label: 'retry' },
    { id: 'inspect', label: 'inspect' },
    { id: 'archive', label: 'archive' },
  ];

  const grants = new Set(['workflows-admin:cancel', 'workflows-admin:retry', 'runs-admin:archive']);
  const denials = new Set(['workflows-read:retry', 'runs-read:cancel']);

  function getCellState(
    row: PermissionMatrixAxisItem,
    column: PermissionMatrixAxisItem,
  ): PermissionMatrixCellState {
    const key = `${row.id}:${column.id}`;
    if (grants.has(key)) return 'granted';
    if (denials.has(key)) return 'denied';
    return 'not-applicable';
  }
</script>

<PermissionMatrix
  label="Operation scope matrix"
  description="Rows are authorization scopes; columns are operations."
  {rows}
  {columns}
  {getCellState}
  onCellClick={(row, column) => console.log(row.id, column.id)}
/>
