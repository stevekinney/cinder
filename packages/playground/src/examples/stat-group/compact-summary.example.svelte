<script lang="ts" module>
  export const title = 'Compact summary strip';
  export const description =
    'Dense summaries can tune StatGroup spacing and Stat typography through public CSS variables.';
</script>

<script lang="ts">
  import { StatGroup } from '@lostgradient/cinder/stat-group';
</script>

<StatGroup
  label="Workflow summary"
  columns={4}
  variant="shared-borders"
  style="--cinder-stat-group-gap: 1px; --cinder-stat-group-shared-cell-padding: var(--cinder-space-2);"
>
  <StatGroup.Stat
    label="Events"
    value={128}
    style="--cinder-stat-row-gap: 0; --cinder-stat-label-font-size: var(--cinder-text-xs); --cinder-stat-value-font-size: var(--cinder-text-lg); --cinder-stat-change-font-size: var(--cinder-text-xs);"
  />
  <StatGroup.Stat
    label="Matched"
    value={42}
    style="--cinder-stat-row-gap: 0; --cinder-stat-label-font-size: var(--cinder-text-xs); --cinder-stat-value-font-size: var(--cinder-text-lg); --cinder-stat-change-font-size: var(--cinder-text-xs);"
  />
  <StatGroup.Stat
    label="Retries"
    value={3}
    style="--cinder-stat-row-gap: 0; --cinder-stat-label-font-size: var(--cinder-text-xs); --cinder-stat-value-font-size: var(--cinder-text-lg); --cinder-stat-change-font-size: var(--cinder-text-xs);"
  />
  <StatGroup.Stat
    label="Latency"
    value="184 ms"
    style="--cinder-stat-row-gap: 0; --cinder-stat-label-font-size: var(--cinder-text-xs); --cinder-stat-value-font-size: var(--cinder-text-lg); --cinder-stat-change-font-size: var(--cinder-text-xs);"
  />
</StatGroup>
