<script lang="ts" module>
  export const title = 'Danger zone action';
  export const description =
    'A destructive action inside a danger-tone Card with the confirmation flow delegated to ConfirmDialog.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Card } from '@lostgradient/cinder/card';
  import { ConfirmDialog } from '@lostgradient/cinder/confirm-dialog';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
  let deleted = $state(false);
</script>

<Card
  tone="danger"
  title="Delete project"
  description="Permanently removes project settings, review history, and saved automation rules."
>
  <p style="margin: 0; color: var(--cinder-text-subtle); font-size: var(--cinder-text-sm);">
    {deleted
      ? 'The deletion flow completed.'
      : 'Export any data you need before deleting this project.'}
  </p>

  {#snippet footer()}
    <Button
      variant="danger"
      label="Delete project"
      disabled={deleted}
      onclick={(event) => {
        triggerRef = event.currentTarget as HTMLElement;
        open = true;
      }}
    />
  {/snippet}
</Card>

<ConfirmDialog
  bind:open
  {triggerRef}
  title="Delete this project?"
  description="This action is permanent. Project settings, review history, and automation rules cannot be restored."
  destructive
  confirmLabel="Delete project"
  onconfirm={() => (deleted = true)}
  oncancel={() => (open = false)}
/>
