<script lang="ts" module>
  export const title = 'Basic event stream';
  export const description =
    'A minimal operational event log with severity tones, timestamps, and source labels. Suitable for job runners, deploy logs, and webhook traces.';
</script>

<script lang="ts">
  import { EventStreamViewer } from '@lostgradient/cinder/event-stream-viewer';
  import type { StreamEvent } from '@lostgradient/cinder/event-stream-viewer';

  const events: StreamEvent[] = [
    {
      id: 'evt-1',
      datetime: '2026-05-12T14:30:00Z',
      timestamp: '14:30:00',
      severity: 'info',
      source: 'orchestrator',
      summary: 'Workflow run started',
    },
    {
      id: 'evt-2',
      datetime: '2026-05-12T14:30:02Z',
      timestamp: '14:30:02',
      severity: 'info',
      source: 'activity-worker',
      summary: 'Scheduled activity: SendWelcomeEmail',
    },
    {
      id: 'evt-3',
      datetime: '2026-05-12T14:30:05Z',
      timestamp: '14:30:05',
      severity: 'success',
      source: 'activity-worker',
      summary: 'Activity completed: SendWelcomeEmail',
    },
    {
      id: 'evt-4',
      datetime: '2026-05-12T14:30:08Z',
      timestamp: '14:30:08',
      severity: 'warning',
      source: 'activity-worker',
      summary: 'Retrying activity: ChargePayment (attempt 1 of 3)',
    },
    {
      id: 'evt-5',
      datetime: '2026-05-12T14:30:15Z',
      timestamp: '14:30:15',
      severity: 'error',
      source: 'activity-worker',
      summary: 'Activity failed: ChargePayment — payment gateway timeout',
    },
  ];
</script>

<EventStreamViewer {events} label="Basic workflow events" />
