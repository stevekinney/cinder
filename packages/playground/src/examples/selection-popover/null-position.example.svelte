<script lang="ts" module>
  export const title = 'Null position clears the popover';
  export const description =
    'Setting position to null hides the popover even while open is true — verifies the consumer can clear an active selection without re-rendering the host.';
</script>

<script lang="ts">
  import type { SelectionPopoverPosition } from 'cinder/selection-popover';
  import { SelectionPopover } from 'cinder/selection-popover';

  const initialPosition: SelectionPopoverPosition = { x: 220, y: 140 };
  let position = $state<SelectionPopoverPosition | null>(initialPosition);

  function clearPosition(): void {
    position = null;
  }

  function restorePosition(): void {
    position = initialPosition;
  }
</script>

<div style="position: relative; min-height: 10rem;">
  <div style="display: flex; gap: 0.5rem;">
    <button
      type="button"
      onclick={clearPosition}
      style="padding: 0.375rem 0.75rem; border: 1px solid var(--cinder-border); border-radius: var(--cinder-radius-sm); background: var(--cinder-surface); cursor: pointer;"
    >
      Clear position (set null)
    </button>
    <button
      type="button"
      onclick={restorePosition}
      style="padding: 0.375rem 0.75rem; border: 1px solid var(--cinder-border); border-radius: var(--cinder-radius-sm); background: var(--cinder-surface); cursor: pointer;"
    >
      Restore position
    </button>
  </div>

  <p style="max-width: 36rem; margin: 0.75rem 0 0;">
    The popover starts open at a real position. Clicking <em>Clear position</em> sets
    <code>position={'{null}'}</code>
    while leaving <code>open</code> true — the popover should disappear because the component calls
    <code>hidePopover()</code>. <em>Restore position</em> brings it back at the original coordinates.
  </p>

  <SelectionPopover id="null-position-selection-popover" open {position} />
</div>
