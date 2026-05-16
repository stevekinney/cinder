<script lang="ts" module>
  export const title = 'Action button';
  export const description =
    'Clicking the action dismisses the toast by default. Set keepOpen: true to keep it visible after the action fires.';
</script>

<script lang="ts">
  import { Button, ToastRegion, useToast } from '../../../../components/src/index.ts';
</script>

<ToastRegion>
  {#snippet children()}
    {@const toast = useToast()}
    <div class="example-preview-row">
      <Button
        label="Dismiss on action"
        onclick={() =>
          toast.show('File ready to download.', {
            variant: 'success',
            duration: 0,
            action: {
              label: 'Download',
              onAction: () => toast.show('Download started.', { variant: 'info' }),
            },
          })}
      />
      <Button
        label="Keep open after action"
        variant="secondary"
        onclick={() =>
          toast.show('Deployment in progress.', {
            variant: 'info',
            duration: 0,
            action: {
              label: 'View logs',
              onAction: () => toast.show('Logs opened.', { variant: 'success' }),
              keepOpen: true,
            },
          })}
      />
    </div>
  {/snippet}
</ToastRegion>
