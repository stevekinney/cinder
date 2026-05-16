<script lang="ts" module>
  export const title = 'Modal-scoped region';
  export const description =
    'Nest <ToastRegion> inside a Modal to scope toasts to the modal lifecycle. Closing the modal tears down its toasts.';
</script>

<script lang="ts">
  import { Button, Modal, ToastRegion, useToast } from '../../../../components/src/index.ts';

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

<Modal bind:open title="Modal-scoped toasts" {triggerRef}>
  <ToastRegion>
    {#snippet children()}
      {@const toast = useToast()}
      <p>
        Toasts dispatched here belong to this modal's region. When the modal closes, its region
        unmounts and any active toasts are torn down.
      </p>
      <div class="example-preview-row">
        <Button
          label="Show success"
          onclick={() => toast.show('Saved inside the modal.', { variant: 'success' })}
        />
        <Button
          variant="danger"
          label="Show danger"
          onclick={() => toast.show('Something went wrong.', { variant: 'danger' })}
        />
      </div>
    {/snippet}
  </ToastRegion>
  {#snippet footer()}
    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
      <Button variant="secondary" label="Close" onclick={() => (open = false)} />
    </div>
  {/snippet}
</Modal>
