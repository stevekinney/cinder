<script lang="ts" module>
  export const title = 'Swipe to dismiss';
  export const description = 'Dismiss a toast by dragging it horizontally past the threshold.';
</script>

<script lang="ts">
  import { useToast } from 'cinder';
  import { Button } from 'cinder/button';
  import { ToastRegion } from 'cinder/toast-region';
</script>

<ToastRegion>
  {#snippet children()}
    {@const toast = useToast()}
    <Button
      label="Show swipe toast"
      onclick={() =>
        toast.show('Drag this notification left or right to dismiss it.', {
          duration: 0,
        })}
    />
  {/snippet}
</ToastRegion>
