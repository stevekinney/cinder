<script lang="ts" module>
  export const title = 'Basic single-select';
  export const description =
    'A simple quiz question with four answer options and roving keyboard focus.';
</script>

<script lang="ts">
  import { ChoiceGrid } from '@lostgradient/cinder/choice-grid';

  let selected = $state<string | null>(null);
</script>

<ChoiceGrid ariaLabel="What is the capital of France?" bind:value={selected}>
  <ChoiceGrid.Item value="london">London</ChoiceGrid.Item>
  <ChoiceGrid.Item value="berlin">Berlin</ChoiceGrid.Item>
  <ChoiceGrid.Item value="paris">Paris</ChoiceGrid.Item>
  <ChoiceGrid.Item value="madrid">Madrid</ChoiceGrid.Item>
</ChoiceGrid>

{#if selected}
  <p style="margin-top: 1rem; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm);">
    Selected: {selected}
  </p>
{/if}
