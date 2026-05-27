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
  }: {
    disabled?: boolean;
    longPressDelay?: number;
    open?: boolean;
    anchorPoint?: { x: number; y: number };
  } = $props();
</script>

{#snippet menuContent()}
  <DropdownItem>Open</DropdownItem>
  <DropdownItem disabled>Disabled action</DropdownItem>
{/snippet}

<ContextMenu {disabled} {longPressDelay} {open} {anchorPoint}>
  <ContextMenuTrigger class="context-menu-region">
    <button type="button" class="context-menu-button">File one.txt</button>
  </ContextMenuTrigger>
  <DropdownMenu>
    {@render menuContent()}
  </DropdownMenu>
</ContextMenu>

<div class="context-menu-selection"></div>
