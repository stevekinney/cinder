<script lang="ts" module>
  export const title = 'Basic segmented control';
  export const description = 'A compact radio-group control with keyboard navigation.';
</script>

<script lang="ts">
  import { Segment, SegmentedControl } from '../../../../components/src/index.ts';

  let value = $state('rendered');
</script>

<div style="display: grid; gap: 0.75rem; justify-items: start;">
  <SegmentedControl id="playground-view" selectionMode="single" bind:value label="Document view">
    <Segment value="source">Source</Segment>
    <Segment value="rendered">Rendered</Segment>
    <Segment value="diff">Diff</Segment>
  </SegmentedControl>
  <p style="margin: 0; color: var(--cinder-text-muted);">Current view: {value}</p>
</div>
