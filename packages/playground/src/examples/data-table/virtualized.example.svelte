<script lang="ts" module>
  export const title = 'Virtualized data table';
  export const description =
    'A semantic table that windows 10,000 fixed-height body rows while preserving full row counts and row indexes.';
</script>

<script lang="ts">
  import { DataTable } from '@lostgradient/cinder/data-table';

  type LogRow = {
    event: string;
    source: string;
    severity: 'Info' | 'Warn' | 'Error';
    message: string;
  };

  const severities: LogRow['severity'][] = ['Info', 'Warn', 'Error'];
  const rows: LogRow[] = Array.from({ length: 10_000 }, (_, index) => ({
    event: `evt-${index.toString().padStart(5, '0')}`,
    source: `worker-${index % 16}`,
    severity: severities[index % severities.length] ?? 'Info',
    message: `Handled append-only log row ${index.toLocaleString('en-US')}`,
  }));

  const columns = [
    { key: 'event' as const, label: 'Event', rowHeader: true },
    { key: 'source' as const, label: 'Source' },
    { key: 'severity' as const, label: 'Severity' },
    { key: 'message' as const, label: 'Message' },
  ];
</script>

<DataTable
  caption="Workflow log tail"
  {columns}
  {rows}
  virtualized
  density="condensed"
  rowHeight={36}
  height="360px"
  overscan={4}
  scrollable
/>
