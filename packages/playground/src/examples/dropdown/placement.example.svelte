<script lang="ts" module>
  export const title = 'Placement';
  export const description = 'bottom-start and bottom-end placement options.';
</script>

<script lang="ts">
  import { Button, Dropdown } from '../../../../components/src/index.ts';

  let openStart = $state(false);
  let openEnd = $state(false);
</script>

<div class="example-preview-row">
  <Dropdown bind:open={openStart} placement="bottom-start">
    {#snippet trigger()}
      <Button variant="secondary">Bottom-start</Button>
    {/snippet}
    <div style="padding: 0.5rem 1rem; min-width: 140px;">Aligned to left edge</div>
  </Dropdown>

  <Dropdown bind:open={openEnd} placement="bottom-end">
    {#snippet trigger()}
      <Button variant="secondary">Bottom-end</Button>
    {/snippet}
    <div style="padding: 0.5rem 1rem; min-width: 140px;">Aligned to right edge</div>
  </Dropdown>
</div>
