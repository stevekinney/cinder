<script lang="ts" module>
  export const title = 'Compact summary strip';
  export const description =
    'Dense summaries can tune StatisticGroup spacing and Statistic typography through public CSS variables.';
</script>

<script lang="ts">
  import { StatisticGroup } from '@lostgradient/cinder/statistic-group';
</script>

<StatisticGroup
  label="Workflow summary"
  columns={4}
  variant="shared-borders"
  style="--cinder-statistic-group-gap: 1px; --cinder-statistic-group-shared-cell-padding: var(--cinder-space-2);"
>
  <StatisticGroup.Statistic
    label="Events"
    value={128}
    style="--cinder-statistic-row-gap: 0; --cinder-statistic-label-font-size: var(--cinder-text-xs); --cinder-statistic-value-font-size: var(--cinder-text-lg); --cinder-statistic-change-font-size: var(--cinder-text-xs);"
  />
  <StatisticGroup.Statistic
    label="Matched"
    value={42}
    style="--cinder-statistic-row-gap: 0; --cinder-statistic-label-font-size: var(--cinder-text-xs); --cinder-statistic-value-font-size: var(--cinder-text-lg); --cinder-statistic-change-font-size: var(--cinder-text-xs);"
  />
  <StatisticGroup.Statistic
    label="Retries"
    value={3}
    style="--cinder-statistic-row-gap: 0; --cinder-statistic-label-font-size: var(--cinder-text-xs); --cinder-statistic-value-font-size: var(--cinder-text-lg); --cinder-statistic-change-font-size: var(--cinder-text-xs);"
  />
  <StatisticGroup.Statistic
    label="Latency"
    value="184 ms"
    style="--cinder-statistic-row-gap: 0; --cinder-statistic-label-font-size: var(--cinder-text-xs); --cinder-statistic-value-font-size: var(--cinder-text-lg); --cinder-statistic-change-font-size: var(--cinder-text-xs);"
  />
</StatisticGroup>
