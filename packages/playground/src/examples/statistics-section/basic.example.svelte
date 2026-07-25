<script lang="ts" module>
  export const title = 'StatisticsSection';
  export const description =
    'StatisticsSection composing StatisticGroup + Statistic for a marketing KPI band with trends.';
</script>

<script lang="ts">
  import { StatisticsSection } from '@lostgradient/cinder/statistics-section';

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

<StatisticsSection
  title="Outcomes teams achieve with Cinder"
  description="Measured improvements after standardizing on shared UI patterns."
  {stats}
  variant="cards"
/>
