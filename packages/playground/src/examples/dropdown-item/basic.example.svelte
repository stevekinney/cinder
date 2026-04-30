<script lang="ts" module>
  export const title = 'Dropdown item';
  export const description = 'Menu items can close on selection and carry a danger variant.';
</script>

<script lang="ts">
  import {
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
  } from '../../../../components/src/index.ts';

  let selected = $state('None');
</script>

<div style="display: grid; gap: 0.75rem;">
  <Dropdown id="item-demo">
    <DropdownTrigger>Document actions</DropdownTrigger>
    <DropdownMenu>
      <DropdownItem onclick={() => (selected = 'Copy link')}>Copy link</DropdownItem>
      <DropdownItem variant="danger" onclick={() => (selected = 'Delete')}>Delete</DropdownItem>
    </DropdownMenu>
  </Dropdown>
  <p style="margin: 0; color: var(--cinder-text-muted);">Selected: {selected}</p>
</div>
