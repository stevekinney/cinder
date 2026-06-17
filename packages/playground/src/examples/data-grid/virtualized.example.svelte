<script lang="ts" module>
  export const title = 'Virtualized activity log';
  export const description =
    'A fixed-height DataGrid window rendering 50,000 rows and a horizontal column window with pinned edges.';
</script>

<script lang="ts">
  import { DataGrid, type DataGridColumnDef } from '@lostgradient/cinder/data-grid';

  type LogEntry = {
    id: string;
    timestamp: string;
    source: string;
    severity: 'Info' | 'Warn' | 'Error';
    message: string;
    region: string;
    shard: string;
    durationMs: number;
    retries: number;
    queue: string;
    tenant: string;
    bytes: number;
    httpStatus: number;
    traceId: string;
  };

  const severities: LogEntry['severity'][] = ['Info', 'Warn', 'Error'];
  const rows: LogEntry[] = Array.from({ length: 50_000 }, (_, index) => ({
    id: `log-${index}`,
    timestamp: `2026-06-17T${String(index % 24).padStart(2, '0')}:00:00Z`,
    source: `worker-${index % 12}`,
    severity: severities[index % severities.length] ?? 'Info',
    message: `Processed event ${index.toLocaleString('en-US')}`,
    region: ['iad', 'sfo', 'fra', 'sin'][index % 4] ?? 'iad',
    shard: `shard-${index % 24}`,
    durationMs: 18 + (index % 180),
    retries: index % 4,
    queue: ['ingest', 'billing', 'exports'][index % 3] ?? 'ingest',
    tenant: `tenant-${index % 80}`,
    bytes: 512 + index * 13,
    httpStatus: [200, 200, 202, 429, 500][index % 5] ?? 200,
    traceId: `trace-${index.toString(16).padStart(8, '0')}`,
  }));

  const columns: DataGridColumnDef<LogEntry>[] = [
    { key: 'timestamp', header: 'Timestamp', width: 220, pin: 'left' },
    { key: 'source', header: 'Source', width: 140 },
    { key: 'severity', header: 'Severity', width: 120 },
    { key: 'region', header: 'Region', width: 120 },
    { key: 'shard', header: 'Shard', width: 120 },
    {
      key: 'durationMs',
      header: 'Duration',
      width: 120,
      getValue: (entry) => `${entry.durationMs}ms`,
    },
    { key: 'retries', header: 'Retries', width: 110 },
    { key: 'queue', header: 'Queue', width: 140 },
    { key: 'tenant', header: 'Tenant', width: 160 },
    {
      key: 'bytes',
      header: 'Bytes',
      width: 140,
      getValue: (entry) => entry.bytes.toLocaleString('en-US'),
    },
    { key: 'httpStatus', header: 'HTTP', width: 100 },
    { key: 'traceId', header: 'Trace', width: 180 },
    { key: 'message', header: 'Message', width: 320, pin: 'right' },
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
  virtualizeColumns
  rowHeight={32}
  aria-label="Virtualized activity log"
  style="max-block-size: 420px;"
  getRowAriaLabel={(entry) => `${entry.id}, ${entry.severity}, ${entry.message}`}
/>
