<script lang="ts">
  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';

  interface Props {
    open?: boolean;
    size?: boolean;
    arrowVisible?: boolean;
    lockPlacement?: boolean;
    /**
     * Opt into a VIRTUAL anchor whose identity changes with `anchorGeneration`,
     * mirroring CommandMenu's caret anchor (a `$derived` over the caret index, so a
     * fresh object on every keystroke). Off by default so the existing boundary
     * tests keep anchoring to the real button element.
     */
    virtualAnchor?: boolean;
    anchorGeneration?: number;
  }

  let {
    open = true,
    size = true,
    arrowVisible = false,
    lockPlacement = false,
    virtualAnchor = false,
    anchorGeneration = 0,
  }: Props = $props();

  let anchor = $state<HTMLButtonElement | null>(null);
  let panel = $state<HTMLDivElement | null>(null);
  let boundary = $state<HTMLDivElement | null>(null);
  let arrow = $state<HTMLSpanElement | null>(null);

  const caretAnchor = $derived.by(() => {
    // Read the generation so a bump produces a genuinely new object, exactly as
    // CommandMenu's caretAnchor does when selectionGeneration ticks.
    void anchorGeneration;
    const element = anchor;
    if (!element) return null;
    return { getBoundingClientRect: () => element.getBoundingClientRect() };
  });

  const overlay = createAnchoredOverlay({
    open: () => open,
    anchor: () => (virtualAnchor ? caretAnchor : anchor),
    panel: () => panel,
    boundary: () => boundary,
    size: () => size,
    sizeMaxBlockSize: () => '24rem',
    arrow: () => arrow,
    arrowVisible: () => arrowVisible,
    lockPlacement: () => lockPlacement,
  });
</script>

<div bind:this={boundary} data-testid="boundary">
  <button bind:this={anchor} type="button">Anchor</button>
  <div bind:this={panel} data-testid="panel" style={overlay.positionStyle}>
    Panel
    <span bind:this={arrow} data-testid="arrow" style={overlay.arrowStyle}></span>
  </div>
</div>
