<script lang="ts" module>
  export const title = 'Multi-select segmented control';
  export const description =
    'Multiple options can be toggled independently. Pass a SvelteSet to track selection.';
</script>

<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { Segment } from '@lostgradient/cinder/segment';
  import { SegmentedControl } from '@lostgradient/cinder/segmented-control';

  let formats = new SvelteSet<string>();

  const selected = $derived([...formats].join(', ') || 'none');
</script>

<div style="display: grid; gap: 0.75rem; justify-items: start;">
  <SegmentedControl
    id="playground-format"
    selectionMode="multiple"
    value={formats}
    label="Text formatting"
  >
    <Segment value="bold">Bold</Segment>
    <Segment value="italic">Italic</Segment>
    <Segment value="underline">Underline</Segment>
    <Segment value="strikethrough">Strike</Segment>
  </SegmentedControl>
  <p style="margin: 0; color: var(--cinder-text-muted);">Active formats: {selected}</p>
</div>
