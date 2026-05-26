<script lang="ts" module>
  export const title = 'Confirm dialog';
  export const description =
    'A destructive action gated behind an explicit confirm and cancel prompt.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { ConfirmDialog } from 'cinder/confirm-dialog';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
  let lastAction = $state('');
</script>

<div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
  <Button
    label="Delete item"
    variant="danger"
    onclick={(event) => {
      triggerRef = event.currentTarget as HTMLElement;
      open = true;
    }}
  />

  {#if lastAction}
    <p style="margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm);">
      Last action: <strong>{lastAction}</strong>
    </p>
  {/if}
</div>

<ConfirmDialog
  bind:open
  {triggerRef}
  title="Delete item?"
  description="This permanently removes the item. This action cannot be undone."
  destructive
  confirmLabel="Delete"
  onconfirm={() => (lastAction = 'confirmed')}
  oncancel={() => (lastAction = 'cancelled')}
/>
