<script lang="ts" module>
  export const title = 'Reconnect replay with sequence gap';
  export const description =
    'Shows a reconnect boundary after retained events replay, followed by an advisory sequence-gap marker.';
</script>

<script lang="ts">
  import { EventStreamViewer } from '@lostgradient/cinder/event-stream-viewer';
  import type { EventStreamEntry } from '@lostgradient/cinder/event-stream-viewer';

  const events: EventStreamEntry[] = [
    {
      id: 'evt-41',
      sequence: 41,
      datetime: '2026-05-12T16:04:10Z',
      timestamp: '16:04:10',
      severity: 'info',
      source: 'orchestrator',
      summary: 'Run resumed from retained stream cursor',
    },
    {
      id: 'evt-42',
      sequence: 42,
      datetime: '2026-05-12T16:04:11Z',
      timestamp: '16:04:11',
      severity: 'success',
      source: 'activity-worker',
      summary: 'Replayed completion: ValidateInvoice',
    },
    {
      id: 'reconnect-1',
      kind: 'reconnected',
      datetime: '2026-05-12T16:04:12Z',
      timestamp: '16:04:12',
      replayedCount: 2,
    },
    {
      id: 'evt-45',
      sequence: 45,
      datetime: '2026-05-12T16:04:15Z',
      timestamp: '16:04:15',
      severity: 'warning',
      source: 'stream-gateway',
      summary: 'Received event after missing sequence 43 and 44',
    },
    {
      id: 'evt-46',
      sequence: 46,
      datetime: '2026-05-12T16:04:16Z',
      timestamp: '16:04:16',
      severity: 'info',
      source: 'orchestrator',
      summary: 'Requested replay from last acknowledged sequence',
    },
  ];
</script>

<EventStreamViewer {events} label="Replay stream with reconnect and sequence gap" />
