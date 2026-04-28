<script lang="ts" module>
  export const title = 'Modal with form';
  export const description = 'A modal containing an input that receives focus on open.';
</script>

<script lang="ts">
  import { Button, Input, Modal } from '../../../../components/src/index.ts';

  let open = $state(false);
  let name = $state('');
  let triggerRef: HTMLButtonElement | undefined = $state();
</script>

<button bind:this={triggerRef} type="button" onclick={() => (open = true)}>Rename item</button>

<Modal bind:open title="Rename item" {triggerRef}>
  <Input id="modal-name" bind:value={name} label="New name" placeholder="Enter a name…" />
  {#snippet footer()}
    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
      <Button variant="secondary" label="Cancel" onclick={() => (open = false)} />
      <Button variant="primary" label="Save" onclick={() => (open = false)} />
    </div>
  {/snippet}
</Modal>
