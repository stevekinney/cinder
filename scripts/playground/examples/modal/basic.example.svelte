<script lang="ts" module>
  export const title = 'Basic modal';
  export const description = 'A dialog opened by a button; Escape key closes it.';
</script>

<script lang="ts">
  import { Button, Modal } from '../../../../src/index.ts';

  let open = $state(false);
  let triggerRef: HTMLButtonElement | undefined = $state();
</script>

<button bind:this={triggerRef} type="button" onclick={() => (open = true)}>Open modal</button>

<Modal bind:open title="Confirm action" {triggerRef}>
  <p>Are you sure you want to proceed? This action cannot be undone.</p>
  {#snippet footer()}
    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
      <Button variant="secondary" label="Cancel" onclick={() => (open = false)} />
      <Button variant="danger" label="Confirm" onclick={() => (open = false)} />
    </div>
  {/snippet}
</Modal>
