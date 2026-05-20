<script lang="ts" module>
  export const title = 'Modal-scoped region';
  export const description =
    'Nest <ToastRegion> inside a Modal to scope toasts to the modal content. When the modal body unmounts on close, the region tears down with it and pending timers are cleared.';
</script>

<script lang="ts">
  import { useToast } from 'cinder';
  import { Button } from 'cinder/button';
  import { Modal } from 'cinder/modal';
  import { ToastRegion } from 'cinder/toast-region';
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
