<script lang="ts" module>
  export const title = 'Basic segmented control';
  export const description = 'A compact radio-group control with keyboard navigation.';
</script>

<script lang="ts">
  import { SegmentedControl } from 'cinder/segmented-control';
  let value = $state('rendered');

  const options = [
    { value: 'source', label: 'Source' },
    { value: 'rendered', label: 'Rendered' },
    { value: 'diff', label: 'Diff' },
  ];
</script>

<div style="display: grid; gap: 0.75rem; justify-items: start;">
  <SegmentedControl
    id="playground-view"
    selectionMode="single"
    bind:value
    label="Document view"
    {options}
  />
  <p style="margin: 0; color: var(--cinder-text-muted);">Current view: {value}</p>
</div>
