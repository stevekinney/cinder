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
  let pointerIsDown = false;

  // Mirrors selection-popover.svelte's own unconditional (not `enabled`-gated)
  // pointer tracking, so this fixture exercises the exact wiring pattern
  // production uses for the isPointerDown option below.
  $effect(() => {
    const markPointerDown = () => {
      pointerIsDown = true;
    };
    const markPointerUp = () => {
      pointerIsDown = false;
    };
    const pointerTrackingOptions: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener('pointerdown', markPointerDown, pointerTrackingOptions);
    window.addEventListener('pointerup', markPointerUp, pointerTrackingOptions);
    window.addEventListener('pointercancel', markPointerUp, pointerTrackingOptions);
    return () => {
      window.removeEventListener('pointerdown', markPointerDown, pointerTrackingOptions);
      window.removeEventListener('pointerup', markPointerUp, pointerTrackingOptions);
      window.removeEventListener('pointercancel', markPointerUp, pointerTrackingOptions);
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
    isPointerDown: () => pointerIsDown,
    onDismiss: (preventScroll) => onDismiss?.(preventScroll),
    onFocusMovedOutside: () => onFocusMovedOutside?.(),
  });
</script>

<div bind:this={panel} data-testid="panel">
  <div bind:this={composerForm} data-testid="composer-form">
    <textarea data-testid="textarea"></textarea>
  </div>
</div>
