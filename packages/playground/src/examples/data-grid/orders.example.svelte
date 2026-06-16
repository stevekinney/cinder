<script lang="ts" module>
  export const title = 'Pinned order grid';
  export const description =
    'A static ARIA grid with stable row ids, explicit column widths, and a pinned identifier column.';
</script>

<script lang="ts">
  import { DataGrid, type DataGridColumnDef } from '@lostgradient/cinder/data-grid';

  type Order = {
    id: string;
    customer: string;
    status: string;
    total: number;
    updated: string;
  };

  const orders: Order[] = [
    { id: 'ORD-1001', customer: 'Ada Lovelace', status: 'Packed', total: 124, updated: 'Today' },
    {
      id: 'ORD-1002',
      customer: 'Grace Hopper',
      status: 'Shipped',
      total: 256,
      updated: 'Yesterday',
    },
    { id: 'ORD-1003', customer: 'Alan Turing', status: 'Queued', total: 88, updated: 'Monday' },
    {
      id: 'ORD-1004',
      customer: 'Margaret Hamilton',
      status: 'Delivered',
      total: 318,
      updated: 'Friday',
    },
  ];

  const columns: DataGridColumnDef<Order>[] = [
    { key: 'id', header: 'Order', width: 120, pin: 'left' },
    { key: 'customer', header: 'Customer', width: 220 },
    { key: 'status', header: 'Status', width: 140 },
    { key: 'total', header: 'Total', width: 120, getValue: (order) => `$${order.total}` },
    { key: 'updated', header: 'Updated', width: 160 },
  ];
</script>

<DataGrid
  rows={orders}
  {columns}
  getRowId={(order) => order.id}
  aria-label="Orders"
  getRowAriaLabel={(order) => `${order.id}, ${order.customer}, ${order.status}`}
/>
