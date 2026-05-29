<script lang="ts" module>
  export const title = 'Vertical timeline';
  export const description = 'A timestamp-first event rail for workflow and audit history.';
</script>

<script lang="ts">
  import Timeline from 'cinder/timeline';

  const entries = [
    {
      id: 'created',
      datetime: '2026-05-23T14:00:00Z',
      timestamp: '9:00 AM',
      title: 'Deployment created',
      tone: 'info' as const,
    },
    {
      id: 'validated',
      datetime: '2026-05-23T14:04:00Z',
      timestamp: '9:04 AM',
      title: 'Configuration validated',
      tone: 'success' as const,
    },
    {
      id: 'queued',
      datetime: '2026-05-23T14:10:00Z',
      timestamp: '9:10 AM',
      title: 'Rollout queued',
      tone: 'warning' as const,
    },
  ];
</script>

<Timeline {entries} label="Deployment timeline">
  {#snippet children(entry)}
    {entry.title === 'Rollout queued'
      ? 'Waiting for the current production deploy to finish.'
      : 'Completed by the release automation.'}
  {/snippet}
</Timeline>
