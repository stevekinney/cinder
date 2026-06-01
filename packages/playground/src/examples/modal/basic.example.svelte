<script lang="ts" module>
  export const title = 'Basic modal';
  export const description = 'A modal used as a generic content shell with a scrollable body area.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { Modal } from 'cinder/modal';
  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
</script>

<Button
  label="View release notes"
  onclick={(event) => {
    triggerRef = event.currentTarget;
    open = true;
  }}
/>

<Modal bind:open title="What's new in v3.0" {triggerRef}>
  <div style="display: grid; gap: 1rem;">
    <section>
      <h3 style="margin: 0 0 0.25rem; font-size: var(--cinder-text-base);">
        New component: AlertDialog
      </h3>
      <p style="margin: 0; color: var(--cinder-text-muted);">
        A sticky blocking acknowledgement dialog that cannot be dismissed by Escape or backdrop
        click. Use it for session expiry, system errors, and other conditions that require an
        explicit response.
      </p>
    </section>
    <section>
      <h3 style="margin: 0 0 0.25rem; font-size: var(--cinder-text-base);">Refined dialog model</h3>
      <p style="margin: 0; color: var(--cinder-text-muted);">
        Modal is now documented as a generic shell. ConfirmDialog handles binary decisions;
        AlertDialog handles urgent acknowledgements. Each has a clear interaction contract.
      </p>
    </section>
    <section>
      <h3 style="margin: 0 0 0.25rem; font-size: var(--cinder-text-base);">Overlay policy</h3>
      <p style="margin: 0; color: var(--cinder-text-muted);">
        Focus capture, body scroll lock, and the Escape stack are shared across Modal, Sheet, and
        Drawer via a single internal helper. Each overlay calls the same primitives.
      </p>
    </section>
  </div>

  {#snippet footer()}
    <Button label="Close" onclick={() => (open = false)} />
  {/snippet}
</Modal>
