<script lang="ts" module>
  export const title = 'Delete account';
  export const description =
    'A destructive ConfirmDialog for permanent account and data deletion. Default focus lands on Cancel to guard against accidental confirmation.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { ConfirmDialog } from '@lostgradient/cinder/confirm-dialog';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
  let lastAction = $state('');
</script>

<div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
  <Button
    label="Delete account"
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
  title="Delete your account?"
  description="This will permanently delete your account and all associated data. This action cannot be undone."
  destructive
  confirmLabel="Delete account"
  onconfirm={() => (lastAction = 'account deleted')}
  oncancel={() => (lastAction = 'cancelled')}
/>
