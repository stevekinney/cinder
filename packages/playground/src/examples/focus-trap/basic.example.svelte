<script lang="ts" module>
  export const title = 'Basic focus trap';
  export const description =
    'Keeps Tab navigation inside the rendered surface until the trap is removed.';
</script>

<script lang="ts">
  import { Button, FocusTrap } from '@lostgradient/cinder';

  let open = $state(false);
</script>

<Button onclick={() => (open = !open)}>
  {open ? 'Close focus trap' : 'Open focus trap'}
</Button>

{#if open}
  <FocusTrap
    style="
      display: inline-flex;
      gap: var(--cinder-space-3);
      margin-block-start: var(--cinder-space-4);
      padding: var(--cinder-space-4);
      border: 1px solid var(--cinder-border);
      border-radius: var(--cinder-radius-lg);
      background: var(--cinder-surface-raised);
    "
  >
    <Button variant="secondary">Cancel</Button>
    <Button>Save changes</Button>
  </FocusTrap>
{/if}
