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
    onDismiss: (preventScroll) => onDismiss?.(preventScroll),
    onFocusMovedOutside: () => onFocusMovedOutside?.(),
  });
</script>

<div bind:this={panel} data-testid="panel">
  <div bind:this={composerForm} data-testid="composer-form">
    <textarea data-testid="textarea"></textarea>
  </div>
</div>
