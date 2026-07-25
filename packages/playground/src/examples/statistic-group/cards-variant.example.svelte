<script lang="ts" module>
  export const title = 'Cards variant';
  export const description =
    'The `cards` variant renders each metric as a discrete bordered card, separating the tiles instead of laying them out edge-to-edge in a shared grid.';
</script>

<script lang="ts">
  import { StatisticGroup } from '@lostgradient/cinder/statistic-group';
</script>

<StatisticGroup label="This quarter" columns={3} variant="cards">
  <StatisticGroup.Statistic label="Projects" value={42} />
  <StatisticGroup.Statistic label="Members" value={18} />
  <StatisticGroup.Statistic label="Storage" value="64 GB" />
</StatisticGroup>
