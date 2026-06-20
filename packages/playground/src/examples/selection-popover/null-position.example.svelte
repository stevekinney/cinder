<script lang="ts" module>
  export const title = 'Null position clears the popover';
  export const description =
    'Setting position to null hides the popover even while open is true — the consumer can clear an active selection without changing the open flag.';
</script>

<script lang="ts">
  import type { SelectionPopoverPosition } from '@lostgradient/cinder/selection-popover';
  import { Button } from '@lostgradient/cinder/button';
  import { SelectionPopover } from '@lostgradient/cinder/selection-popover';

  const popoverId = 'null-position-selection-popover';

  let isOpen = $state(false);
  let position = $state<SelectionPopoverPosition | null>(null);
  let anchorElement = $state<HTMLElement | null>(null);

  function showPopover(): void {
    if (!anchorElement) return;

    const rect = anchorElement.getBoundingClientRect();
    position = {
      x: rect.left + rect.width / 2,
      y: rect.top,
      height: rect.height,
    };
    isOpen = true;
  }

  function clearPosition(): void {
    position = null;
    // open stays true — the component should hide because position is null.
  }

  function restorePosition(): void {
    showPopover();
  }
</script>

<div style="max-width: 36rem;">
  <p style="margin: 0 0 0.75rem; line-height: 1.5;">
    Demonstrates that setting <code>position</code> to <code>null</code> hides the popover even when
    <code>open</code>
    remains <code>true</code>. Click <em>Show popover</em> to open it, then use
    <em>Clear position</em>
    to set <code>position=null</code> while leaving
    <code>open=true</code> — the popover disappears because the component has no anchor point to
    position against. Use <em>Restore position</em> to bring it back without changing
    <code>open</code>.
  </p>

  <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
    <span bind:this={anchorElement} style="display: inline-flex;">
      <Button label="Show popover" onclick={showPopover} />
    </span>
    <Button label="Clear position (set null)" onclick={clearPosition} disabled={!isOpen} />
    <Button label="Restore position" onclick={restorePosition} disabled={!isOpen} />
  </div>

  <p style="margin: 0; font-size: var(--cinder-text-sm); color: var(--cinder-text-muted);">
    Status: open={isOpen}, position={position ? `{x:${position.x},y:${position.y}}` : 'null'}
  </p>
</div>

<SelectionPopover id={popoverId} open={isOpen} {position} />
