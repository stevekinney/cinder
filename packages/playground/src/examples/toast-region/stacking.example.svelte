<script lang="ts" module>
  export const title = 'Stacking';
  export const description = 'Rapid notifications stack with bounded overflow and visual depth.';
</script>

<script lang="ts">
  import { useToast } from 'cinder';
  import { Button } from 'cinder/button';
  import { ToastRegion } from 'cinder/toast-region';

  let count = $state(0);
</script>

<ToastRegion maxStack={5} defaultDuration={0}>
  {#snippet children()}
    {@const toast = useToast()}
    <Button
      label="Add five toasts"
      onclick={() => {
        for (let index = 0; index < 5; index += 1) {
          count += 1;
          toast.show(`Stacked notification ${count}`, {
            variant: index % 2 === 0 ? 'info' : 'success',
          });
        }
      }}
    />
  {/snippet}
</ToastRegion>
