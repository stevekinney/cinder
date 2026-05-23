<script lang="ts" module>
  export const title = 'Every-Layout composition';
  export const description =
    'Stack contains an Inline header with a Spacer pushing a trailing action, and a Cluster of chips.';
</script>

<script lang="ts">
  import { Stack } from 'cinder/stack';
  import { Inline } from 'cinder/inline';
  import { Cluster } from 'cinder/cluster';
  import { Spacer } from 'cinder/spacer';
</script>

<Stack gap="1.5rem">
  <Inline>
    <strong>Section title</strong>
    <Spacer />
    <button type="button">Action</button>
  </Inline>
  <Cluster>
    <span>tag-one</span>
    <span>tag-two</span>
    <span>tag-three</span>
    <span>tag-four</span>
  </Cluster>
</Stack>
