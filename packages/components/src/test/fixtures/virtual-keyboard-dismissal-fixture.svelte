<script lang="ts">
  import { createVirtualKeyboardDismissal } from '../../components/selection-popover/virtual-keyboard-dismissal.svelte.ts';

  interface Props {
    enabled?: boolean;
    onDismiss?: (preventScroll: boolean) => void;
    onFocusMovedOutside?: () => void;
  }

  let { enabled = true, onDismiss, onFocusMovedOutside }: Props = $props();

  let panel = $state<HTMLDivElement | null>(null);
  let composerForm = $state<HTMLDivElement | null>(null);
  // A count, not a boolean: mirrors selection-popover.svelte's own tracking,
  // which must not re-arm scroll-dismissal when one of several simultaneously
  // held pointers is released.
  let activePointerCount = 0;
  const pointerIsDown = () => activePointerCount > 0;

  // Mirrors selection-popover.svelte's own unconditional (not `enabled`-gated)
  // pointer tracking, so this fixture exercises the exact wiring pattern
  // production uses for the isPointerDown option below.
  $effect(() => {
    const markPointerDown = () => {
      activePointerCount += 1;
    };
    const markPointerUp = () => {
      activePointerCount = Math.max(0, activePointerCount - 1);
    };
    const pointerTrackingOptions: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener('pointerdown', markPointerDown, pointerTrackingOptions);
    window.addEventListener('pointerup', markPointerUp, pointerTrackingOptions);
    window.addEventListener('pointercancel', markPointerUp, pointerTrackingOptions);
    return () => {
      window.removeEventListener('pointerdown', markPointerDown, pointerTrackingOptions);
      window.removeEventListener('pointerup', markPointerUp, pointerTrackingOptions);
      window.removeEventListener('pointercancel', markPointerUp, pointerTrackingOptions);
      activePointerCount = 0;
    };
  });

  createVirtualKeyboardDismissal({
    enabled: () => enabled,
    panel: () => panel,
    composerForm: () => composerForm,
    // Ownership in this fixture is driven purely by real DOM focus
    // (composerForm.contains(document.activeElement)) rather than a
    // separate "composer has a draft" flag — that's the mechanism this
    // test exercises directly.
    composerOwnsKeyboard: () => false,
    isRestoringFocus: () => false,
    isPointerDown: pointerIsDown,
    onDismiss: (preventScroll) => onDismiss?.(preventScroll),
    onFocusMovedOutside: () => onFocusMovedOutside?.(),
  });
</script>

<div bind:this={panel} data-testid="panel">
  <div bind:this={composerForm} data-testid="composer-form">
    <textarea data-testid="textarea"></textarea>
  </div>
</div>
