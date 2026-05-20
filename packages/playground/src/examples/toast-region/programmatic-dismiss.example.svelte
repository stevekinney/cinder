<script lang="ts" module>
  export const title = 'Programmatic dismiss';
  export const description =
    'show() returns the toast id. Capture it to dismiss a specific toast, or call dismissAll() to clear both stacks.';
</script>

<script lang="ts">
  import { useToast } from 'cinder';
  import { Button } from 'cinder/button';
  import { ToastRegion } from 'cinder/toast-region';
  let lastId: string | null = $state(null);
</script>

<ToastRegion>
  {#snippet children()}
    {@const toast = useToast()}
    <div class="example-preview-row">
      <Button
        label="Show sticky"
        onclick={() => {
          lastId = toast.show('Sticky toast — dismiss me programmatically.', {
            variant: 'info',
            duration: 0,
          });
        }}
      />
      <Button
        variant="secondary"
        label="Dismiss last"
        onclick={() => {
          if (lastId) {
            toast.dismiss(lastId);
            lastId = null;
          }
        }}
      />
      <Button variant="secondary" label="Dismiss all" onclick={() => toast.dismissAll()} />
    </div>
  {/snippet}
</ToastRegion>
