<script lang="ts" module>
  export const title = 'Operational log';
  export const description =
    'The log arm: an append-only operator-facing stream with follow-latest scrolling, connection state, and tone-marked entries. Suitable for job runners, deploy logs, and webhook traces.';
</script>

<script lang="ts">
  import { Feed } from '@lostgradient/cinder/feed';
  import type { FeedEventTone } from '@lostgradient/cinder/feed-event';

  const events: {
    id: string;
    datetime: string;
    timestamp: string;
    tone: FeedEventTone;
    source: string;
    summary: string;
  }[] = [
    {
      id: 'evt-1',
      datetime: '2026-05-12T14:30:00Z',
      timestamp: '14:30:00',
      tone: 'info',
      source: 'orchestrator',
      summary: 'Workflow run started',
    },
    {
      id: 'evt-2',
      datetime: '2026-05-12T14:30:02Z',
      timestamp: '14:30:02',
      tone: 'info',
      source: 'activity-worker',
      summary: 'Scheduled activity: SendWelcomeEmail',
    },
    {
      id: 'evt-3',
      datetime: '2026-05-12T14:30:05Z',
      timestamp: '14:30:05',
      tone: 'success',
      source: 'activity-worker',
      summary: 'Activity completed: SendWelcomeEmail',
    },
    {
      id: 'evt-4',
      datetime: '2026-05-12T14:30:08Z',
      timestamp: '14:30:08',
      tone: 'warning',
      source: 'activity-worker',
      summary: 'Retrying activity: ChargePayment (attempt 1 of 3)',
    },
    {
      id: 'evt-5',
      datetime: '2026-05-12T14:30:15Z',
      timestamp: '14:30:15',
      tone: 'error',
      source: 'activity-worker',
      summary: 'Activity failed: ChargePayment — payment gateway timeout',
    },
  ];
</script>

<Feed kind="log" label="Basic workflow events" connectionState="connected">
  {#each events as event (event.id)}
    <Feed.Event
      variant="minimal"
      datetime={event.datetime}
      timestamp={event.timestamp}
      tone={event.tone}
    >
      <span style="color: var(--cinder-text-muted);">{event.source}</span>
      {event.summary}
    </Feed.Event>
  {/each}
</Feed>
