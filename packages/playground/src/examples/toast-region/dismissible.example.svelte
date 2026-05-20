<script lang="ts" module>
  export const title = 'Dismissible sticky toast';
  export const description = 'duration: 0 keeps the toast until the user dismisses it.';
</script>

<script lang="ts">
  import { useToast } from 'cinder';
  import { Button } from 'cinder/button';
  import { ToastRegion } from 'cinder/toast-region';
</script>

<ToastRegion>
  {#snippet children()}
    {@const toast = useToast()}
    <div class="example-preview-row">
      <Button
        label="Show sticky warning"
        variant="secondary"
        onclick={() =>
          toast.show('Your session expires in 5 minutes.', {
            variant: 'warning',
            duration: 0,
            dismissible: true,
          })}
      />
    </div>
  {/snippet}
</ToastRegion>
