<script lang="ts" module>
  export const title = 'Shared-borders variant';
  export const description =
    'The `shared-borders` variant wraps the whole set in a single outer border and divides the tiles with 1px gap rules, keeping the grid visually unified.';
</script>

<script lang="ts">
  import { StatGroup } from '@lostgradient/cinder/stat-group';
</script>

<StatGroup label="This quarter" columns={3} variant="shared-borders">
  <StatGroup.Stat label="Projects" value={42} />
  <StatGroup.Stat label="Members" value={18} />
  <StatGroup.Stat label="Storage" value="64 GB" />
</StatGroup>
