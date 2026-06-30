<script lang="ts" module>
  export const title = 'StatsSection';
  export const description =
    'StatsSection composing StatGroup + Stat for a marketing KPI band with trends.';
</script>

<script lang="ts">
  import { StatsSection } from '@lostgradient/cinder/stats-section';

  const stats = [
    { label: 'Uptime', value: '99.99%' },
    { label: 'Deploys / month', value: 420, changeValue: '+18%', changeDirection: 'up' as const },
    {
      label: 'Mean time to ship',
      value: '2.4 days',
      changeValue: '-11%',
      changeDirection: 'down' as const,
    },
  ];
</script>

<StatsSection
  title="Outcomes teams achieve with Cinder"
  description="Measured improvements after standardizing on shared UI patterns."
  {stats}
  variant="cards"
/>
