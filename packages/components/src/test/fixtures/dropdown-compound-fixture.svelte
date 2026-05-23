<script lang="ts">
  import Dropdown from '../../components/dropdown/dropdown.svelte';
  import DropdownGroup from '../../components/dropdown-group/dropdown-group.svelte';
  import DropdownItem from '../../components/dropdown-item/dropdown-item.svelte';
  import DropdownLabel from '../../components/dropdown-label/dropdown-label.svelte';
  import DropdownMenu from '../../components/dropdown-menu/dropdown-menu.svelte';
  import DropdownSeparator from '../../components/dropdown-separator/dropdown-separator.svelte';
  import DropdownTrigger from '../../components/dropdown-trigger/dropdown-trigger.svelte';

  let selected = $state('');
</script>

<div>
  <Dropdown id="actions-menu">
    <DropdownTrigger class="trigger">Actions</DropdownTrigger>
    <DropdownMenu>
      <DropdownGroup labelledBy="actions-menu-document-label">
        <DropdownLabel id="actions-menu-document-label">Document</DropdownLabel>
        <DropdownItem onclick={() => (selected = 'copy')}>Copy link</DropdownItem>
      </DropdownGroup>
      <DropdownSeparator />
      <DropdownGroup labelledBy="actions-menu-sharing-label">
        <DropdownLabel id="actions-menu-sharing-label">Sharing</DropdownLabel>
        <DropdownItem onclick={() => (selected = 'share')}>Invite people</DropdownItem>
        <DropdownItem variant="danger" onclick={() => (selected = 'archive')}>Archive</DropdownItem>
      </DropdownGroup>
    </DropdownMenu>
  </Dropdown>

  <output>{selected}</output>
</div>
