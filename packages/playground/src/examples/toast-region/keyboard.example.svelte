<script lang="ts" module>
  export const title = 'Keyboard dismiss';
  export const description =
    'Focus a toast control and press Escape to dismiss the active notification.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { ToastRegion, useToast } from '@lostgradient/cinder/toast-region';
</script>

<ToastRegion>
  {#snippet children()}
    {@const toast = useToast()}
    <Button
      label="Show keyboard toast"
      onclick={() =>
        toast.show('Tab to this toast, then press Escape.', {
          duration: 0,
          action: {
            label: 'Action',
            keepOpen: true,
            onAction: () => {},
          },
        })}
    />
  {/snippet}
</ToastRegion>
