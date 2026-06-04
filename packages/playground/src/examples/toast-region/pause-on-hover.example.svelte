<script lang="ts" module>
  export const title = 'Pause on hover';
  export const description =
    'Pointer hover and keyboard focus pause auto-dismiss for the whole stack.';
</script>

<script lang="ts">
  import { useToast } from '@lostgradient/cinder';
  import { Button } from '@lostgradient/cinder/button';
  import { ToastRegion } from '@lostgradient/cinder/toast-region';
</script>

<ToastRegion defaultDuration={2500}>
  {#snippet children()}
    {@const toast = useToast()}
    <Button
      label="Show timed toast"
      onclick={() =>
        toast.show('Hover or focus the stack to pause this countdown.', {
          action: {
            label: 'Keep',
            keepOpen: true,
            onAction: () => {},
          },
        })}
    />
  {/snippet}
</ToastRegion>
