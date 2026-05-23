<script lang="ts" module>
  export const title = 'Custom dot styles';
  export const description = 'A timeline with decorative marker snippets for each tone.';
</script>

<script lang="ts">
  import Timeline from 'cinder/experimental/timeline';

  const entries = [
    {
      id: 'green',
      datetime: '2026-05-23T13:00:00Z',
      timestamp: '8:00 AM',
      title: 'Health check passed',
      tone: 'success' as const,
    },
    {
      id: 'yellow',
      datetime: '2026-05-23T13:05:00Z',
      timestamp: '8:05 AM',
      title: 'Capacity warning',
      tone: 'warning' as const,
    },
    {
      id: 'red',
      datetime: '2026-05-23T13:12:00Z',
      timestamp: '8:12 AM',
      title: 'Rollback triggered',
      tone: 'error' as const,
    },
  ];
</script>

<Timeline {entries} label="Incident timeline">
  {#snippet marker(entry)}
    {entry.tone === 'error' ? '!' : ''}
  {/snippet}

  {#snippet children(entry)}
    {entry.title}
  {/snippet}
</Timeline>
