<script lang="ts" module>
  export const title = 'Basic portal';
  export const description =
    'Renders a floating surface through document.body while leaving the trigger inline.';
</script>

<script lang="ts">
  import { Button, Portal } from 'cinder';

  let open = $state(false);
</script>

<Button onclick={() => (open = !open)}>
  {open ? 'Hide portal' : 'Show portal'}
</Button>

{#if open}
  <Portal>
    <div
      style="
        position: fixed;
        inset-block-end: var(--cinder-space-4);
        inset-inline-end: var(--cinder-space-4);
        max-width: 18rem;
        padding: var(--cinder-space-4);
        border: 1px solid var(--cinder-border);
        border-radius: var(--cinder-radius-lg);
        background: var(--cinder-surface-raised);
        box-shadow: var(--cinder-shadow-lg);
      "
    >
      <strong>Portaled content</strong>
      <p>This surface is rendered through <code>document.body</code>.</p>
    </div>
  </Portal>
{/if}
