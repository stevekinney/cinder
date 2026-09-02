<script lang="ts" module>
  export const title = 'Multi-row group';
  export const description =
    'More metrics than columns, so the grid wraps. The default variant draws a vertical divider between neighbours and suppresses it at the end of each row, and a fixed column count collapses as the group itself narrows.';
</script>

<script lang="ts">
  import { StatisticGroup } from '@lostgradient/cinder/statistic-group';
</script>

<StatisticGroup label="Pipeline health" columns={3}>
  <StatisticGroup.Statistic label="Builds" value={412} />
  <StatisticGroup.Statistic label="Passed" value={397} />
  <StatisticGroup.Statistic label="Failed" value={15} />
  <StatisticGroup.Statistic label="Median duration" value="6m 12s" />
  <StatisticGroup.Statistic label="Cache hit rate" value="91%" />
  <StatisticGroup.Statistic label="Flaky reruns" value={4} />
</StatisticGroup>
