<script lang="ts" module>
  export const title = 'Modal-scoped region';
  export const description =
    'A ToastRegion nested inside a modal creates an independent queue. Toasts dispatched from within the modal stay local to it and are cleared when the modal unmounts.';
</script>

<script lang="ts">
  import { Button, Modal, ToastRegion, useToast } from '../../../../components/src/index.ts';

  let open = $state(false);
</script>

<Button label="Open modal" onclick={() => (open = true)} />

<Modal bind:open title="Modal with scoped toasts">
  {#snippet children()}
    <ToastRegion>
      {#snippet children()}
        {@const toast = useToast()}
        <p style="margin-bottom: 1rem;">
          Toasts dispatched here are scoped to this modal. They disappear when the modal closes.
        </p>
        <div class="example-preview-row">
          <Button
            label="Show info"
            onclick={() => toast.show('This toast lives inside the modal.', { variant: 'info' })}
          />
          <Button
            label="Show success"
            onclick={() => toast.show('Action completed successfully.', { variant: 'success' })}
          />
        </div>
      {/snippet}
    </ToastRegion>
  {/snippet}
</Modal>
