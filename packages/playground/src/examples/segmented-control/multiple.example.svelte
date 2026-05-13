<script lang="ts" module>
  export const title = 'Multi-select segmented control';
  export const description =
    'Multiple options can be toggled independently. Bind a SvelteSet to track selection.';
</script>

<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { SegmentedControl } from '../../../../components/src/index.ts';

  let formats = new SvelteSet<string>();

  const options = [
    { value: 'bold', label: 'Bold' },
    { value: 'italic', label: 'Italic' },
    { value: 'underline', label: 'Underline' },
    { value: 'strikethrough', label: 'Strike' },
  ];

  const selected = $derived([...formats].join(', ') || 'none');
</script>

<div style="display: grid; gap: 0.75rem; justify-items: start;">
  <SegmentedControl
    id="playground-format"
    selectionMode="multiple"
    bind:value={formats}
    label="Text formatting"
    {options}
  />
  <p style="margin: 0; color: var(--cinder-text-muted);">Active formats: {selected}</p>
</div>
