<script lang="ts" module>
  export const title = 'Basic click-away listener';
  export const description =
    'Calls a function when the user presses a pointer outside the wrapped subtree.';
</script>

<script lang="ts">
  import { Button, ClickAwayListener } from '@lostgradient/cinder';

  let open = $state(false);
</script>

<Button onclick={() => (open = true)}>Open inline editor</Button>

{#if open}
  <ClickAwayListener
    onclickaway={() => (open = false)}
    style="
      display: inline-flex;
      flex-direction: column;
      gap: var(--cinder-space-3);
      margin-block-start: var(--cinder-space-4);
      padding: var(--cinder-space-4);
      border: 1px solid var(--cinder-border);
      border-radius: var(--cinder-radius-lg);
      background: var(--cinder-surface-raised);
    "
  >
    <p style="margin: 0;">Click outside this box to dismiss it.</p>
    <Button variant="secondary" onclick={() => (open = false)}>Close</Button>
  </ClickAwayListener>
{/if}
