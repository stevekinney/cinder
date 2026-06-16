<script lang="ts" module>
  export const title = 'Gap threshold';
  export const description =
    'With `gapThresholdMinutes`, the connector after an entry is hidden when the next entry is more than that many minutes away — visually breaking the line across large time gaps.';
</script>

<script lang="ts">
  import Timeline from '@lostgradient/cinder/timeline';

  const entries = [
    {
      id: 'deploy-start',
      datetime: '2026-05-18T09:00:00Z',
      timestamp: '9:00 AM',
      title: 'Deploy started',
      tone: 'info' as const,
    },
    {
      id: 'deploy-done',
      datetime: '2026-05-18T09:12:00Z',
      timestamp: '9:12 AM',
      title: 'Deploy completed',
      tone: 'success' as const,
    },
    {
      id: 'incident',
      datetime: '2026-05-18T14:45:00Z',
      timestamp: '2:45 PM',
      title: 'Incident reported',
      tone: 'warning' as const,
    },
  ];
</script>

<Timeline {entries} gapThresholdMinutes={60} label="Release timeline">
  {#snippet children(entry)}
    {entry.title}
  {/snippet}
</Timeline>
