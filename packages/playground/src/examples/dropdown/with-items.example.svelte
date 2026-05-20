<script lang="ts" module>
  export const title = 'With clickable items';
  export const description =
    'DropdownItem accepts onclick handlers and a danger variant for destructive actions.';
</script>

<script lang="ts">
  import { Dropdown } from 'cinder/dropdown';
  import { DropdownItem } from 'cinder/dropdown-item';
  import { DropdownMenu } from 'cinder/dropdown-menu';
  import { DropdownTrigger } from 'cinder/dropdown-trigger';
  let selected = $state('None');
</script>

<div style="display: grid; gap: 0.75rem;">
  <Dropdown id="dropdown-with-items">
    <DropdownTrigger>Document actions</DropdownTrigger>
    <DropdownMenu>
      <DropdownItem onclick={() => (selected = 'Copy link')}>Copy link</DropdownItem>
      <DropdownItem onclick={() => (selected = 'Duplicate')}>Duplicate</DropdownItem>
      <DropdownItem variant="danger" onclick={() => (selected = 'Delete')}>Delete</DropdownItem>
    </DropdownMenu>
  </Dropdown>
  <p style="margin: 0; color: var(--cinder-text-muted);">Selected: {selected}</p>
</div>
