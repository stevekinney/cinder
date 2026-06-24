<script lang="ts">
  import Dropdown from '../../components/dropdown/dropdown.svelte';
  import DropdownGroup from '../../components/dropdown-group/dropdown-group.svelte';
  import DropdownItem from '../../components/dropdown-item/dropdown-item.svelte';
  import DropdownLabel from '../../components/dropdown-label/dropdown-label.svelte';
  import DropdownMenu from '../../components/dropdown-menu/dropdown-menu.svelte';
  import DropdownTrigger from '../../components/dropdown-trigger/dropdown-trigger.svelte';
</script>

<Dropdown id="view-menu">
  <DropdownTrigger class="trigger">View</DropdownTrigger>
  <DropdownMenu>
    <DropdownGroup labelledBy="view-menu-label">
      <DropdownLabel id="view-menu-label">View</DropdownLabel>
      <DropdownItem itemRole="menuitemradio" checked>Compact</DropdownItem>
      <DropdownItem itemRole="menuitemradio">Comfortable</DropdownItem>
    </DropdownGroup>
  </DropdownMenu>
</Dropdown>
