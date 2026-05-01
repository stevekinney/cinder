<script lang="ts" module>
  export const title = 'Basic toast region';
  export const description =
    'Click the trigger to dispatch a transient toast into the live region.';
</script>

<script lang="ts">
  import { Button, ToastRegion, useToast } from '../../../../components/src/index.ts';
</script>

<ToastRegion>
  {#snippet children()}
    {@const toast = useToast()}
    <div class="example-preview-row">
      <Button
        label="Show success"
        onclick={() => toast.show('Saved your changes.', { variant: 'success' })}
      />
      <Button
        variant="secondary"
        label="Show info"
        onclick={() => toast.show('A new version is available.', { variant: 'info' })}
      />
    </div>
  {/snippet}
</ToastRegion>
