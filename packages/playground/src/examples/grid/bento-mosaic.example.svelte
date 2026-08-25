<script lang="ts" module>
  export const title = 'Asymmetric bento mosaic';
  export const description =
    'A deliberate feature-tile mosaic recipe: Grid with narrowCollapseEnabled and Grid.Item span/rowSpan replace the retired BentoGrid/BentoCell components.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
  import { Grid } from '@lostgradient/cinder/grid';
</script>

<Grid
  as="section"
  columns="repeat(4, minmax(0, 1fr))"
  gap="var(--cinder-space-4)"
  narrowCollapseEnabled
  aria-label="Product highlights"
>
  <Grid.Item span={2} rowSpan={2}>
    <Card>Realtime analytics</Card>
  </Grid.Item>
  <Grid.Item span={2}>
    <Card>Workflow automation</Card>
  </Grid.Item>
  <Grid.Item rowSpan={2}>
    <Card>Compliance controls</Card>
  </Grid.Item>
  <Grid.Item>
    <Card>Usage insights</Card>
  </Grid.Item>
  <Grid.Item>
    <Card>Team collaboration</Card>
  </Grid.Item>
</Grid>
