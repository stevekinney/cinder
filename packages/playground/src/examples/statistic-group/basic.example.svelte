<script lang="ts" module>
  export const title = 'Basic stat group';
  export const description =
    'A row of summary metrics. Uses the StatisticGroup namespace API: StatisticGroup.Statistic renders each metric inside the parent StatisticGroup grid.';
</script>

<script lang="ts">
  import { StatisticGroup } from '@lostgradient/cinder/statistic-group';
</script>

<StatisticGroup label="This quarter" columns={3}>
  <StatisticGroup.Statistic
    label="Monthly revenue"
    value={48250}
    valueFormatOptions={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
    change={{ value: '4.75%', direction: 'up', description: 'from last month' }}
  />
  <StatisticGroup.Statistic
    label="Active users"
    value={1289}
    change={{ value: '12', direction: 'up', description: 'this week' }}
  />
  <StatisticGroup.Statistic
    label="Churn"
    value="2.1%"
    change={{ value: '0.3%', direction: 'down', description: 'vs prior period' }}
  />
</StatisticGroup>
