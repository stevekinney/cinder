<script lang="ts" module>
  export const title = 'Narrow collapse';
  export const description =
    'With narrowCollapseEnabled, Grid falls back to a single column and resets item placement once its own width is 48rem or less.';
</script>

<script lang="ts">
  import { Grid } from '@lostgradient/cinder/grid';
</script>

<Grid
  columns={3}
  gap="var(--cinder-space-4)"
  narrowCollapseEnabled
  aria-label="Narrow collapse demo"
>
  <div style="padding: 1rem; border: 1px solid var(--cinder-border-muted);">One</div>
  <div style="padding: 1rem; border: 1px solid var(--cinder-border-muted);">Two</div>
  <div style="padding: 1rem; border: 1px solid var(--cinder-border-muted);">Three</div>
</Grid>
