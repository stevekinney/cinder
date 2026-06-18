<script lang="ts" module>
  export const title = 'Horizontal timeline';
  export const description = 'A compact horizontal timeline for phase comparisons.';
</script>

<script lang="ts">
  import Timeline from '@lostgradient/cinder/timeline';

  const entries = [
    {
      id: 'intake',
      datetime: '2026-05-20',
      timestamp: 'May 20',
      title: 'Intake',
      tone: 'info' as const,
    },
    {
      id: 'design',
      datetime: '2026-05-21',
      timestamp: 'May 21',
      title: 'Design review',
      tone: 'success' as const,
    },
    {
      id: 'ship',
      datetime: '2026-05-23',
      timestamp: 'May 23',
      title: 'Ship candidate',
      tone: 'warning' as const,
    },
  ];

  const details: Record<string, string> = {
    intake: 'Requirements and constraints were collected.',
    design: 'The selected approach passed design review.',
    ship: 'Release validation is waiting on final checks.',
  };
</script>

<Timeline {entries} orientation="horizontal" label="Project phase timeline">
  {#snippet children(entry)}
    {details[entry.id]}
  {/snippet}
</Timeline>
