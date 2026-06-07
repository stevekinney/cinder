<script lang="ts" module>
  export const title = 'Multi-select';
  export const description =
    'Toggle multiple answers simultaneously — useful for checkboxes presented as large tiles.';
</script>

<script lang="ts">
  import { ChoiceGrid } from '@lostgradient/cinder/choice-grid';

  let selected = $state<string[]>([]);
</script>

<ChoiceGrid multiple ariaLabel="Which topics interest you?" bind:values={selected} columns={2}>
  <ChoiceGrid.Item value="design">Design</ChoiceGrid.Item>
  <ChoiceGrid.Item value="engineering">Engineering</ChoiceGrid.Item>
  <ChoiceGrid.Item value="product">Product</ChoiceGrid.Item>
  <ChoiceGrid.Item value="data">Data</ChoiceGrid.Item>
  <ChoiceGrid.Item value="marketing">Marketing</ChoiceGrid.Item>
  <ChoiceGrid.Item value="leadership">Leadership</ChoiceGrid.Item>
</ChoiceGrid>

{#if selected.length > 0}
  <p style="margin-top: 1rem; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm);">
    Selected: {selected.join(', ')}
  </p>
{/if}
