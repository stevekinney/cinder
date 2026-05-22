<script lang="ts" module>
  export const title = 'Toggled by an external trigger';
  export const description =
    'A button outside the popover toggles open. Closing fires onclose; focus restores to the trigger button.';
</script>

<script lang="ts">
  import { SelectionPopover } from 'cinder/selection-popover';

  let isOpen = $state(false);

  function toggle(): void {
    isOpen = !isOpen;
  }

  function handleClose(): void {
    isOpen = false;
  }
</script>

<div style="position: relative; min-height: 9rem;">
  <button
    type="button"
    onclick={toggle}
    style="padding: 0.375rem 0.75rem; border: 1px solid var(--cinder-border); border-radius: var(--cinder-radius-sm); background: var(--cinder-surface); cursor: pointer;"
  >
    {isOpen ? 'Hide popover' : 'Show popover'}
  </button>

  <p style="max-width: 36rem; margin: 0.75rem 0 0;">
    Click the button to open the popover at a fixed position. Click anywhere outside the popover and
    it closes (the consumer flips <code>open</code> to <code>false</code> from
    <code>onclose</code>). Focus returns to the toggle button.
  </p>

  <SelectionPopover
    id="toggled-selection-popover"
    open={isOpen}
    position={{ x: 260, y: 140 }}
    onclose={handleClose}
  />
</div>
