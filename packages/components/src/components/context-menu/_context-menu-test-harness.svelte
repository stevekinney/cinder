<script lang="ts">
  import ContextMenu from './context-menu.svelte';
  import ContextMenuTrigger from '../context-menu-trigger/context-menu-trigger.svelte';
  import DropdownItem from '../dropdown-item/dropdown-item.svelte';
  import DropdownMenu from '../dropdown-menu/dropdown-menu.svelte';

  let {
    disabled = false,
    longPressDelay = 500,
    open = false,
    anchorPoint,
    triggerHandlers = {},
  }: {
    disabled?: boolean;
    longPressDelay?: number;
    open?: boolean;
    anchorPoint?: { x: number; y: number };
    triggerHandlers?: {
      onclick?: (event: MouseEvent) => void;
      oncontextmenu?: (event: MouseEvent) => void;
      onkeydown?: (event: KeyboardEvent) => void;
      onpointerdown?: (event: PointerEvent) => void;
      onpointermove?: (event: PointerEvent) => void;
      onpointerup?: (event: PointerEvent) => void;
    };
  } = $props();

  let selected = $state('');
</script>

{#snippet menuContent()}
  <DropdownItem onclick={() => (selected = 'open')}>Open</DropdownItem>
  <DropdownItem disabled>Disabled action</DropdownItem>
  <DropdownItem onclick={() => (selected = 'rename')}>Rename</DropdownItem>
  <DropdownItem onclick={() => (selected = 'delete')}>Delete</DropdownItem>
{/snippet}

<div>
  <ContextMenu {disabled} {longPressDelay} {open} {anchorPoint}>
    <ContextMenuTrigger class="context-menu-region" {...triggerHandlers}>
      <button type="button" class="context-menu-button">File one.txt</button>
    </ContextMenuTrigger>
    <DropdownMenu>
      {@render menuContent()}
    </DropdownMenu>
  </ContextMenu>

  <div class="context-menu-selection"></div>
  <output class="context-menu-selected">{selected}</output>
</div>
