<script lang="ts" module>
  export const title = 'Action button';
  export const description =
    'Default action dismisses after firing; keepOpen: true keeps the toast visible after the action runs.';
</script>

<script lang="ts">
  import { useToast } from '@lostgradient/cinder';
  import { Button } from '@lostgradient/cinder/button';
  import { ToastRegion } from '@lostgradient/cinder/toast-region';
  let undoCount = $state(0);
  let pauseCount = $state(0);
</script>

<ToastRegion>
  {#snippet children()}
    {@const toast = useToast()}
    <div class="example-preview-row">
      <Button
        label="Dismiss-after-action"
        onclick={() =>
          toast.show('Item moved to trash.', {
            variant: 'info',
            duration: 0,
            action: {
              label: 'Undo',
              onAction: () => (undoCount += 1),
            },
          })}
      />
      <Button
        variant="secondary"
        label="Keep open after action"
        onclick={() =>
          toast.show('Syncing in the background…', {
            variant: 'info',
            duration: 0,
            action: {
              label: 'Pause',
              keepOpen: true,
              onAction: () => (pauseCount += 1),
            },
          })}
      />
    </div>
    <p style="margin-top: 0.75rem; font-size: 0.875rem;">
      Undo fired: {undoCount} · Pause fired: {pauseCount}
    </p>
  {/snippet}
</ToastRegion>
