<script lang="ts" module>
  export const title = 'Virtualized activity log';
  export const description =
    'A fixed-height DataGrid window rendering 50,000 rows with full ARIA row metadata.';
</script>

<script lang="ts">
  import { DataGrid, type DataGridColumnDef } from '@lostgradient/cinder/data-grid';

  type LogEntry = {
    id: string;
    timestamp: string;
    source: string;
    severity: 'Info' | 'Warn' | 'Error';
    message: string;
  };

  const severities: LogEntry['severity'][] = ['Info', 'Warn', 'Error'];
  const rows: LogEntry[] = Array.from({ length: 50_000 }, (_, index) => ({
    id: `log-${index}`,
    timestamp: `2026-06-17T${String(index % 24).padStart(2, '0')}:00:00Z`,
    source: `worker-${index % 12}`,
    severity: severities[index % severities.length] ?? 'Info',
    message: `Processed event ${index.toLocaleString('en-US')}`,
  }));

  const columns: DataGridColumnDef<LogEntry>[] = [
    { key: 'timestamp', header: 'Timestamp', width: 220 },
    { key: 'source', header: 'Source', width: 140 },
    { key: 'severity', header: 'Severity', width: 120 },
    { key: 'message', header: 'Message', width: 320 },
  ];

  const renderStart = typeof performance === 'undefined' ? 0 : performance.now();
  let recordedRenderMeasurement = false;

  $effect(() => {
    if (recordedRenderMeasurement || typeof window === 'undefined') return;

    recordedRenderMeasurement = true;
    requestAnimationFrame(() => {
      Reflect.set(
        window,
        '__cinderDataGridVirtualizedFirstRenderMs',
        performance.now() - renderStart,
      );
    });
  });
</script>

<DataGrid
  {rows}
  {columns}
  getRowId={(entry) => entry.id}
  virtualizeRows
  rowHeight={32}
  aria-label="Virtualized activity log"
  style="max-block-size: 420px;"
  getRowAriaLabel={(entry) => `${entry.id}, ${entry.severity}, ${entry.message}`}
/>
