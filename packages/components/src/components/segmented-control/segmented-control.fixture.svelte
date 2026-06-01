<script lang="ts">
  import Segment from '../segment/segment.svelte';
  import { SegmentedControl } from './index.ts';

  type FixtureProps = {
    selected?: string;
  };

  let { selected = 'rendered' }: FixtureProps = $props();
</script>

<div class="segmented-control-fixture">
  <SegmentedControl
    id="visual-fixture-view"
    selectionMode="single"
    value={selected}
    label="Document view"
  >
    <Segment value="source">Source</Segment>
    <Segment value="rendered">Rendered</Segment>
    <Segment value="diff">Diff</Segment>
  </SegmentedControl>
</div>

<style>
  .segmented-control-fixture {
    display: grid;
    gap: 0.75rem;
    justify-items: start;
  }
</style>
