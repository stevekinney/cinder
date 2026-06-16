<script lang="ts" module>
  export const title = 'Explicit placement';
  export const description =
    'A 12-column grid using Grid.Item for spans while plain children use auto-placement.';
</script>

<script lang="ts">
  import { Grid } from '@lostgradient/cinder/grid';
</script>

<Grid columns={12} gap="var(--cinder-space-4)" aria-label="Profile form layout">
  <Grid.Item span={6}>
    <div style="padding: 1rem; border: 1px solid var(--cinder-border-muted);">First name</div>
  </Grid.Item>
  <Grid.Item span={6}>
    <div style="padding: 1rem; border: 1px solid var(--cinder-border-muted);">Last name</div>
  </Grid.Item>
  <Grid.Item span={12}>
    <div style="padding: 1rem; border: 1px solid var(--cinder-border-muted);">Email address</div>
  </Grid.Item>
</Grid>
