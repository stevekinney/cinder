<script lang="ts" module>
  export const title = 'All four variants';
  export const description =
    'info and success route to the polite (status) region; warning and danger route to the assertive (alert) region.';
</script>

<script lang="ts">
  import { useToast } from '@lostgradient/cinder';
  import { Button } from '@lostgradient/cinder/button';
  import { ToastRegion } from '@lostgradient/cinder/toast-region';
</script>

<ToastRegion>
  {#snippet children()}
    {@const toast = useToast()}
    <div class="example-preview-row">
      <Button
        label="Info"
        onclick={() => toast.show('A new version is available.', { variant: 'info' })}
      />
      <Button
        label="Success"
        onclick={() => toast.show('Saved your changes.', { variant: 'success' })}
      />
      <Button
        variant="secondary"
        label="Warning"
        onclick={() => toast.show('Your session expires in 5 minutes.', { variant: 'warning' })}
      />
      <Button
        variant="danger"
        label="Danger"
        onclick={() => toast.show('Failed to save your changes.', { variant: 'danger' })}
      />
    </div>
  {/snippet}
</ToastRegion>
