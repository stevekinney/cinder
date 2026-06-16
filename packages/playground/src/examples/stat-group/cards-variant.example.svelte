<script lang="ts" module>
  export const title = 'Cards variant';
  export const description =
    'The `cards` variant renders each metric as a discrete bordered card, separating the tiles instead of laying them out edge-to-edge in a shared grid.';
</script>

<script lang="ts">
  import { StatGroup } from '@lostgradient/cinder/stat-group';
</script>

<StatGroup label="This quarter" columns={3} variant="cards">
  <StatGroup.Stat label="Projects" value={42} />
  <StatGroup.Stat label="Members" value={18} />
  <StatGroup.Stat label="Storage" value="64 GB" />
</StatGroup>
