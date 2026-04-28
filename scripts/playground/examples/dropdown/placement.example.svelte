<script lang="ts" module>
  export const title = 'Placement';
  export const description = 'bottom-start and bottom-end placement options.';
</script>

<script lang="ts">
  import { Dropdown } from '../../../../src/index.ts';

  let openStart = $state(false);
  let openEnd = $state(false);
</script>

<div style="display: flex; gap: 1rem;">
  <Dropdown bind:open={openStart} placement="bottom-start">
    {#snippet trigger()}
      <button type="button">Bottom-start ▾</button>
    {/snippet}
    <div style="padding: 0.5rem 1rem; min-width: 140px;">Aligned to left edge</div>
  </Dropdown>

  <Dropdown bind:open={openEnd} placement="bottom-end">
    {#snippet trigger()}
      <button type="button">Bottom-end ▾</button>
    {/snippet}
    <div style="padding: 0.5rem 1rem; min-width: 140px;">Aligned to right edge</div>
  </Dropdown>
</div>
