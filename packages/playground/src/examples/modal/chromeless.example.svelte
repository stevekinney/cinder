<script lang="ts" module>
  export const title = 'Chromeless (full-bleed) modal';
  export const description =
    'chrome="none" suppresses the header, title, border, max-width, and body padding while keeping the focus trap, scroll lock, escape handling, and exit-transition lifecycle unchanged. aria-label supplies the accessible name since no visible title renders.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Modal } from '@lostgradient/cinder/modal';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
</script>

<Button
  label="Open image viewer"
  onclick={(event) => {
    triggerRef = event.currentTarget;
    open = true;
  }}
/>

<Modal bind:open chrome="none" aria-label="Image viewer" closeButtonVisible={false} {triggerRef}>
  <div
    data-cinder-modal-backdrop
    style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; width: 100%; height: 100%; color: white; background: rgba(0, 0, 0, 0.85);"
  >
    <p>Full-bleed content with no header or border.</p>
    <Button label="Close" onclick={() => (open = false)} />
  </div>
</Modal>
