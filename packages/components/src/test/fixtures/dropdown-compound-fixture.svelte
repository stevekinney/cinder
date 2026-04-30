<script lang="ts">
  import Dropdown from '../../components/dropdown.svelte';
  import DropdownItem from '../../components/dropdown-item.svelte';
  import DropdownLabel from '../../components/dropdown-label.svelte';
  import DropdownMenu from '../../components/dropdown-menu.svelte';
  import DropdownSeparator from '../../components/dropdown-separator.svelte';
  import DropdownTrigger from '../../components/dropdown-trigger.svelte';

  let selected = $state('');
</script>

<div>
  <Dropdown id="actions-menu">
    <DropdownTrigger class="trigger">Actions</DropdownTrigger>
    <DropdownMenu>
      <DropdownLabel>Document</DropdownLabel>
      <DropdownItem onclick={() => (selected = 'copy')}>Copy link</DropdownItem>
      <DropdownSeparator />
      <DropdownItem variant="danger" onclick={() => (selected = 'delete')}>Delete</DropdownItem>
    </DropdownMenu>
  </Dropdown>

  <output>{selected}</output>
</div>
