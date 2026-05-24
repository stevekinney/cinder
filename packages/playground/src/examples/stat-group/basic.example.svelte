<script lang="ts" module>
  export const title = 'Basic stat group';
  export const description =
    'A row of summary metrics. Uses the StatGroup namespace API: StatGroup.Stat renders each metric inside the parent StatGroup grid.';
</script>

<script lang="ts">
  import { StatGroup } from 'cinder/stat-group';
</script>

<StatGroup label="This quarter" columns={3}>
  <StatGroup.Stat
    label="Monthly revenue"
    value={48250}
    valueFormatOptions={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
    change={{ value: '4.75%', direction: 'up', description: 'from last month' }}
  />
  <StatGroup.Stat
    label="Active users"
    value={1289}
    change={{ value: '12', direction: 'up', description: 'this week' }}
  />
  <StatGroup.Stat
    label="Churn"
    value="2.1%"
    change={{ value: '0.3%', direction: 'down', description: 'vs prior period' }}
  />
</StatGroup>
