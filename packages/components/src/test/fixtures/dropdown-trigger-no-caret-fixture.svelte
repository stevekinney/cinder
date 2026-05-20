<script lang="ts">
  import Dropdown from '../../components/dropdown/dropdown.svelte';
  import DropdownItem from '../../components/dropdown-item/dropdown-item.svelte';
  import DropdownMenu from '../../components/dropdown-menu/dropdown-menu.svelte';
  import DropdownTrigger from '../../components/dropdown-trigger/dropdown-trigger.svelte';
</script>

<Dropdown id="no-caret-menu">
  <DropdownTrigger class="trigger" showCaret={false}>Actions</DropdownTrigger>
  <DropdownMenu>
    <DropdownItem>Copy link</DropdownItem>
  </DropdownMenu>
</Dropdown>
