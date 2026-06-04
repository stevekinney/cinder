<script lang="ts" module>
  export const title = 'Modal with form';
  export const description =
    'A modal whose first input carries autofocus; the native dialog focuses it on open.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Input } from '@lostgradient/cinder/input';
  import { Modal } from '@lostgradient/cinder/modal';
  let open = $state(false);
  let name = $state('');
  let triggerRef: HTMLElement | null = $state(null);
</script>

<Button
  label="Rename item"
  onclick={(event) => {
    triggerRef = event.currentTarget;
    open = true;
  }}
/>

<Modal bind:open title="Rename item" {triggerRef}>
  <Input id="modal-name" bind:value={name} label="New name" placeholder="Enter a name…" autofocus />
  {#snippet footer()}
    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
      <Button variant="secondary" label="Cancel" onclick={() => (open = false)} />
      <Button variant="primary" label="Save" onclick={() => (open = false)} />
    </div>
  {/snippet}
</Modal>
