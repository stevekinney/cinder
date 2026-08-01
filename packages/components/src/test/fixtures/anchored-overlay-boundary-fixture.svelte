<script lang="ts">
  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';

  interface Props {
    open?: boolean;
    size?: boolean;
  }

  let { open = true, size = true }: Props = $props();

  let anchor = $state<HTMLButtonElement | null>(null);
  let panel = $state<HTMLDivElement | null>(null);
  let boundary = $state<HTMLDivElement | null>(null);

  const overlay = createAnchoredOverlay({
    open: () => open,
    anchor: () => anchor,
    panel: () => panel,
    boundary: () => boundary,
    size: () => size,
    sizeMaxBlockSize: () => '24rem',
  });
</script>

<div bind:this={boundary} data-testid="boundary">
  <button bind:this={anchor} type="button">Anchor</button>
  <div bind:this={panel} data-testid="panel" style={overlay.positionStyle}>Panel</div>
</div>
