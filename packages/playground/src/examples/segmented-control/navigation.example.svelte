<script lang="ts" module>
  export const title = 'Navigation route filters';
  export const description =
    'Use the navigation variant with linked segments when each option should update the URL.';
</script>

<script lang="ts">
  import { Segment } from '@lostgradient/cinder/segment';
  import { SegmentedControl } from '@lostgradient/cinder/segmented-control';

  const sources = [
    { label: 'Actual', href: '/costs?source=actual', current: true },
    { label: 'Forecast', href: '/costs?source=forecast' },
    { label: 'Blended', href: '/costs?source=blended' },
  ];
</script>

<SegmentedControl id="cost-source-filter" label="Cost source" variant="navigation">
  {#each sources as source (source.href)}
    <Segment href={source.href} current={source.current}>{source.label}</Segment>
  {/each}
</SegmentedControl>
