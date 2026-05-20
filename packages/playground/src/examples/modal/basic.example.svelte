<script lang="ts" module>
  export const title = 'Basic modal';
  export const description = 'A dialog opened by a button; Escape key closes it.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { Modal } from 'cinder/modal';
  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
</script>

<Button
  label="Open modal"
  onclick={(event) => {
    triggerRef = event.currentTarget;
    open = true;
  }}
/>

<Modal bind:open title="Confirm action" {triggerRef}>
  <p>Are you sure you want to proceed? This action cannot be undone.</p>
  {#snippet footer()}
    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
      <Button variant="secondary" label="Cancel" onclick={() => (open = false)} />
      <Button variant="danger" label="Confirm" onclick={() => (open = false)} />
    </div>
  {/snippet}
</Modal>
