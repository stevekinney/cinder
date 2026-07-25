<script lang="ts" module>
  export const title = 'Responsive auto columns';
  export const description =
    'Setting `columns` to `auto` switches the grid to CSS auto-fit with minmax, so tiles reflow to fit the available width instead of locking to a fixed column count.';
</script>

<script lang="ts">
  import { StatisticGroup } from '@lostgradient/cinder/statistic-group';
</script>

<StatisticGroup label="Workspace usage" columns="auto">
  <StatisticGroup.Statistic label="Projects" value={42} />
  <StatisticGroup.Statistic label="Members" value={18} />
  <StatisticGroup.Statistic label="Storage" value="64 GB" />
  <StatisticGroup.Statistic
    label="API calls"
    value={128400}
    valueFormatOptions={{ notation: 'compact' }}
  />
</StatisticGroup>
