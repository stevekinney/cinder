<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import Dropdown from '../../components/dropdown/dropdown.svelte';
  import DropdownItem from '../../components/dropdown-item/dropdown-item.svelte';
  import DropdownMenu from '../../components/dropdown-menu/dropdown-menu.svelte';
  import DropdownTrigger from '../../components/dropdown-trigger/dropdown-trigger.svelte';

  let { onclick }: { onclick?: HTMLButtonAttributes['onclick'] } = $props();
</script>

<Dropdown id="onclick-menu">
  <DropdownTrigger class="trigger" {onclick}>Actions</DropdownTrigger>
  <DropdownMenu>
    <DropdownItem>Copy link</DropdownItem>
  </DropdownMenu>
</Dropdown>
