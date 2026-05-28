<script lang="ts" module>
  export const title = 'Promise';
  export const description =
    'Show a sticky loading toast that resolves into success or danger output.';
</script>

<script lang="ts">
  import { useToast } from 'cinder';
  import { Button } from 'cinder/button';
  import { ToastRegion } from 'cinder/toast-region';

  function waitThen<T>(value: T, reject = false) {
    return new Promise<T>((resolve, rejectPromise) => {
      setTimeout(() => {
        if (reject) {
          rejectPromise(new Error('Sync failed.'));
        } else {
          resolve(value);
        }
      }, 900);
    });
  }
</script>

<ToastRegion>
  {#snippet children()}
    {@const toast = useToast()}
    <div class="example-preview-row">
      <Button
        label="Resolve"
        onclick={() =>
          toast.promise(waitThen('profile'), {
            id: 'profile-sync',
            loading: 'Saving profile...',
            success: (value) => `Saved ${value}.`,
            error: 'Save failed.',
          })}
      />
      <Button
        variant="secondary"
        label="Reject"
        onclick={() =>
          toast.promise(waitThen('profile', true), {
            id: 'profile-sync',
            loading: 'Saving profile...',
            success: 'Saved profile.',
            error: (error) => (error instanceof Error ? error.message : 'Save failed.'),
          })}
      />
    </div>
  {/snippet}
</ToastRegion>
