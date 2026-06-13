<script lang="ts" module>
  export const title = 'With search filtering';
  export const description =
    'Consumer-controlled filtering via the onfilter callback. The viewer renders a search input; the consumer owns the filtered events array.';
</script>

<script lang="ts">
  import { EventStreamViewer } from '@lostgradient/cinder/event-stream-viewer';
  import type { StreamEvent } from '@lostgradient/cinder/event-stream-viewer';

  const allEvents: StreamEvent[] = [
    {
      id: 'e1',
      datetime: '2026-05-12T10:00:00Z',
      timestamp: '10:00:00',
      severity: 'info',
      source: 'orchestrator',
      summary: 'Run started: DataPipeline',
    },
    {
      id: 'e2',
      datetime: '2026-05-12T10:00:02Z',
      timestamp: '10:00:02',
      severity: 'debug',
      source: 'extractor',
      summary: 'Connecting to source database',
    },
    {
      id: 'e3',
      datetime: '2026-05-12T10:00:05Z',
      timestamp: '10:00:05',
      severity: 'success',
      source: 'extractor',
      summary: 'Extracted 10,432 records from source',
    },
    {
      id: 'e4',
      datetime: '2026-05-12T10:00:08Z',
      timestamp: '10:00:08',
      severity: 'info',
      source: 'transformer',
      summary: 'Applying transformation rules',
    },
    {
      id: 'e5',
      datetime: '2026-05-12T10:00:12Z',
      timestamp: '10:00:12',
      severity: 'warning',
      source: 'transformer',
      summary: 'Skipped 14 records with missing required fields',
    },
    {
      id: 'e6',
      datetime: '2026-05-12T10:00:15Z',
      timestamp: '10:00:15',
      severity: 'success',
      source: 'loader',
      summary: 'Loaded 10,418 records to destination',
    },
    {
      id: 'e7',
      datetime: '2026-05-12T10:00:16Z',
      timestamp: '10:00:16',
      severity: 'success',
      source: 'orchestrator',
      summary: 'Run completed: DataPipeline',
    },
  ];

  let query = $state('');

  const filteredEvents = $derived(
    query.trim()
      ? allEvents.filter(
          (e) =>
            e.summary.toLowerCase().includes(query.toLowerCase()) ||
            (e.source ?? '').toLowerCase().includes(query.toLowerCase()) ||
            (e.severity ?? '').toLowerCase().includes(query.toLowerCase()),
        )
      : allEvents,
  );
</script>

<EventStreamViewer
  events={filteredEvents}
  filterQuery={query}
  onfilter={(q: string) => {
    query = q;
  }}
  label="DataPipeline run events"
/>
