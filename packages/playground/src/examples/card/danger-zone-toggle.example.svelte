<script lang="ts" module>
  export const title = 'Danger zone setting';
  export const description =
    'A high-risk settings card with container-level danger treatment, a switch, and a confirmation dialog before the risky state is applied.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Card } from '@lostgradient/cinder/card';
  import { ConfirmDialog } from '@lostgradient/cinder/confirm-dialog';
  import { Toggle } from '@lostgradient/cinder/toggle';

  const uid = $props.id();
  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();

  let paused = $state(false);
  let confirmOpen = $state(false);
  let toggleId = $derived(`${mountIdPrefix ?? uid}-pause-reviews`);

  function requestPause(next: boolean): boolean {
    if (!next) return false;
    confirmOpen = true;
    return paused;
  }
</script>

<Card
  tone="danger"
  title="Pause reviews"
  description="Stops new review dispatch globally. Existing in-flight reviews can finish, but no new work will be assigned until reviews are resumed."
>
  <div style="display: grid; gap: var(--cinder-space-3);">
    <Toggle
      id={toggleId}
      bind:checked={paused}
      label="Reviews paused"
      onValueChange={requestPause}
    />
    <p style="margin: 0; color: var(--cinder-text-subtle); font-size: var(--cinder-text-sm);">
      Current state: <strong>{paused ? 'Paused' : 'Dispatching reviews'}</strong>
    </p>
  </div>

  {#snippet footer()}
    {#if paused}
      <Button variant="secondary" label="Resume reviews" onclick={() => (paused = false)} />
    {/if}
  {/snippet}
</Card>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Pause review dispatch?"
  description="This affects every repository connected to the workspace. New reviews will stop until an administrator resumes dispatch."
  destructive
  confirmLabel="Pause reviews"
  onconfirm={() => (paused = true)}
  oncancel={() => (confirmOpen = false)}
/>
