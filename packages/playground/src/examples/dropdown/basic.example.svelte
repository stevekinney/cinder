<script lang="ts" module>
  export const title = 'Basic dropdown';
  export const description = 'A button trigger with a list of menu items.';
</script>

<script lang="ts">
  import {
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
  } from '../../../../components/src/index.ts';
</script>

<Dropdown id="dropdown-basic">
  <DropdownTrigger>Options</DropdownTrigger>
  <DropdownMenu>
    <DropdownItem>Edit</DropdownItem>
    <DropdownItem>Duplicate</DropdownItem>
    <DropdownItem variant="danger">Delete</DropdownItem>
  </DropdownMenu>
</Dropdown>
