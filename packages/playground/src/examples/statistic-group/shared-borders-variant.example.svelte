<script lang="ts" module>
  export const title = 'Shared-borders variant';
  export const description =
    'The `shared-borders` variant wraps the whole set in a single outer border and divides the tiles with 1px gap rules, keeping the grid visually unified.';
</script>

<script lang="ts">
  import { StatisticGroup } from '@lostgradient/cinder/statistic-group';
</script>

<StatisticGroup label="This quarter" columns={3} variant="shared-borders">
  <StatisticGroup.Statistic label="Projects" value={42} />
  <StatisticGroup.Statistic label="Members" value={18} />
  <StatisticGroup.Statistic label="Storage" value="64 GB" />
</StatisticGroup>
