<script lang="ts" module>
  export const title = 'Inline loading lifecycle';
  export const description = 'Inline async action states: active, finished, and error.';
</script>

<script lang="ts">
  import { Button, InlineLoading } from '@lostgradient/cinder';

  let status = $state<'inactive' | 'active' | 'finished' | 'error'>('inactive');
  let message = $state('Saved');

  function startSuccess(): void {
    status = 'active';
    message = 'Saving changes';
    setTimeout(() => {
      status = 'finished';
      message = 'Saved';
    }, 900);
  }

  function startError(): void {
    status = 'active';
    message = 'Saving changes';
    setTimeout(() => {
      status = 'error';
      message = 'Save failed';
    }, 900);
  }
</script>

<div class="example-preview-column" style="align-items: flex-start; gap: 0.75rem;">
  <div class="example-preview-row" style="align-items: center; gap: 0.75rem;">
    <Button type="button" onclick={startSuccess}>Save (success)</Button>
    <Button type="button" variant="secondary" onclick={startError}>Save (error)</Button>
    <InlineLoading {status} description={message} />
  </div>
</div>
