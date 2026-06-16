<script lang="ts" module>
  export const title = 'Responsive auto columns';
  export const description =
    'Setting `columns` to `auto` switches the grid to CSS auto-fit with minmax, so tiles reflow to fit the available width instead of locking to a fixed column count.';
</script>

<script lang="ts">
  import { StatGroup } from '@lostgradient/cinder/stat-group';
</script>

<StatGroup label="Workspace usage" columns="auto">
  <StatGroup.Stat label="Projects" value={42} />
  <StatGroup.Stat label="Members" value={18} />
  <StatGroup.Stat label="Storage" value="64 GB" />
  <StatGroup.Stat label="API calls" value={128400} valueFormatOptions={{ notation: 'compact' }} />
</StatGroup>
