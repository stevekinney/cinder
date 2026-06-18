<script lang="ts" module>
  export const title = 'Grouped by day';
  export const description = 'A timeline grouped by UTC day while preserving source order.';
</script>

<script lang="ts">
  import Timeline from '@lostgradient/cinder/timeline';

  const entries = [
    {
      id: 'monday-1',
      datetime: '2026-05-18T15:00:00Z',
      timestamp: '9:00 AM',
      title: 'Candidate opened',
      groupLabel: 'Monday, May 18',
      tone: 'info' as const,
    },
    {
      id: 'monday-2',
      datetime: '2026-05-18T17:30:00Z',
      timestamp: '11:30 AM',
      title: 'Review completed',
      tone: 'success' as const,
    },
    {
      id: 'tuesday-1',
      datetime: '2026-05-19T16:15:00Z',
      timestamp: '10:15 AM',
      title: 'Production rollout paused',
      groupLabel: 'Tuesday, May 19',
      tone: 'warning' as const,
    },
  ];

  const details: Record<string, string> = {
    'monday-1': 'The release candidate was opened for reviewer feedback.',
    'monday-2': 'Required approvals landed and the candidate moved forward.',
    'tuesday-1': 'Rollout paused while capacity warnings were investigated.',
  };
</script>

<Timeline {entries} groupBy="day" gapThresholdMinutes={90} label="Review timeline">
  {#snippet children(entry)}
    {details[entry.id]}
  {/snippet}
</Timeline>
