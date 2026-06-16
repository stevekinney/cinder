<script lang="ts" module>
  export const title = 'Variable-height cards';
  export const description =
    'CSS columns pack uneven cards into a masonry-style waterfall while keeping DOM order intact.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
  import { Masonry } from '@lostgradient/cinder/masonry';
</script>

<Masonry columns="3" gap="var(--cinder-space-4)" aria-label="Editorial cards">
  <Card>Short note.</Card>
  <Card>
    Longer content with enough copy to create a taller card. CSS columns balance the available
    vertical space without JavaScript measurement.
  </Card>
  <Card>Medium content with a couple of lines.</Card>
  <Card>Another taller item that demonstrates variable height placement across columns.</Card>
</Masonry>
