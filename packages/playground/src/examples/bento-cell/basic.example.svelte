<script lang="ts" module>
  export const title = 'Standalone BentoCell import';
  export const description =
    'BentoCell can be imported directly when you prefer not to use the BentoGrid.Cell namespace.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
  import { BentoGrid } from '@lostgradient/cinder/bento-grid';
  import { BentoCell } from '@lostgradient/cinder/bento-cell';
</script>

<BentoGrid columns={3} gap="var(--cinder-space-4)">
  <BentoCell colSpan={2} rowSpan={2}>
    <Card>Featured capability</Card>
  </BentoCell>
  <BentoCell>
    <Card>Secondary highlight</Card>
  </BentoCell>
  <BentoCell>
    <Card>Supporting detail</Card>
  </BentoCell>
</BentoGrid>
