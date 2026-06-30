<script lang="ts" module>
  export const title = 'Inline loading lifecycle';
  export const description = 'Inline async action states: active, finished, and error.';
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button, InlineLoading } from '@lostgradient/cinder';

  let status = $state<'inactive' | 'active' | 'finished' | 'error'>('inactive');
  let message = $state('Saved');
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  function cancelPending(): void {
    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
  }

  onDestroy(cancelPending);

  function startSuccess(): void {
    cancelPending();
    status = 'active';
    message = 'Saving changes';
    pendingTimeout = setTimeout(() => {
      status = 'finished';
      message = 'Saved';
      pendingTimeout = null;
    }, 900);
  }

  function startError(): void {
    cancelPending();
    status = 'active';
    message = 'Saving changes';
    pendingTimeout = setTimeout(() => {
      status = 'error';
      message = 'Save failed';
      pendingTimeout = null;
    }, 900);
  }
</script>

<div class="example-preview-column" style="align-items: flex-start; gap: 0.75rem;">
  <div class="example-preview-row" style="align-items: center; gap: 0.75rem;">
    <Button type="button" onclick={startSuccess}>Save (success)</Button>
    <Button type="button" variant="secondary" onclick={startError}>Save (error)</Button>
    <InlineLoading bind:status description={message} />
  </div>
</div>
