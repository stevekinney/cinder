<script lang="ts">
  import Dropdown from '../../components/dropdown/dropdown.svelte';
  import DropdownGroup from '../../components/dropdown-group/dropdown-group.svelte';
  import DropdownItem from '../../components/dropdown-item/dropdown-item.svelte';
  import DropdownLabel from '../../components/dropdown-label/dropdown-label.svelte';
  import DropdownMenu from '../../components/dropdown-menu/dropdown-menu.svelte';
  import DropdownSeparator from '../../components/dropdown-separator/dropdown-separator.svelte';
  import DropdownTrigger from '../../components/dropdown-trigger/dropdown-trigger.svelte';
  import type { DropdownPlacement } from '../../components/dropdown/dropdown.types.ts';

  let {
    placement = 'bottom-start',
    triggerStyle,
    menuStyle,
  }: { placement?: DropdownPlacement; triggerStyle?: string; menuStyle?: string } = $props();

  let selected = $state('');
</script>

<div>
  <Dropdown id="actions-menu" {placement}>
    <DropdownTrigger class="trigger" style={triggerStyle}>Actions</DropdownTrigger>
    <DropdownMenu style={menuStyle}>
      <DropdownGroup ariaLabelledby="actions-menu-document-label">
        <DropdownLabel id="actions-menu-document-label">Document</DropdownLabel>
        <DropdownItem onclick={() => (selected = 'copy')}>Copy link</DropdownItem>
      </DropdownGroup>
      <DropdownSeparator />
      <DropdownGroup ariaLabelledby="actions-menu-sharing-label">
        <DropdownLabel id="actions-menu-sharing-label">Sharing</DropdownLabel>
        <DropdownItem onclick={() => (selected = 'share')}>Invite people</DropdownItem>
        <DropdownItem itemRole="menuitemcheckbox" checked onclick={() => (selected = 'keep')}>
          Keep offline
        </DropdownItem>
        <DropdownItem variant="danger" onclick={() => (selected = 'archive')}>Archive</DropdownItem>
      </DropdownGroup>
    </DropdownMenu>
  </Dropdown>

  <output>{selected}</output>
</div>
