<script lang="ts" module>
  export const title = 'Asymmetric bento mosaic';
  export const description =
    'BentoGrid + BentoGrid.Cell creates a deliberate feature-tile mosaic with row and column spans.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
  import { BentoGrid } from '@lostgradient/cinder/bento-grid';
</script>

<BentoGrid columns={4} gap="var(--cinder-space-4)" aria-label="Product highlights">
  <BentoGrid.Cell colSpan={2} rowSpan={2}>
    <Card>Realtime analytics</Card>
  </BentoGrid.Cell>
  <BentoGrid.Cell colSpan={2}>
    <Card>Workflow automation</Card>
  </BentoGrid.Cell>
  <BentoGrid.Cell rowSpan={2}>
    <Card>Compliance controls</Card>
  </BentoGrid.Cell>
  <BentoGrid.Cell>
    <Card>Usage insights</Card>
  </BentoGrid.Cell>
  <BentoGrid.Cell>
    <Card>Team collaboration</Card>
  </BentoGrid.Cell>
</BentoGrid>
