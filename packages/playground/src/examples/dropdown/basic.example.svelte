<script lang="ts" module>
  export const title = 'Basic dropdown';
  export const description = 'A button trigger with a list of menu items.';
</script>

<script lang="ts">
  import { Dropdown } from 'cinder/dropdown';
  import { DropdownItem } from 'cinder/dropdown-item';
  import { DropdownMenu } from 'cinder/dropdown-menu';
  import { DropdownTrigger } from 'cinder/dropdown-trigger';
</script>

<Dropdown id="dropdown-basic">
  <DropdownTrigger>Options</DropdownTrigger>
  <DropdownMenu>
    <DropdownItem>Edit</DropdownItem>
    <DropdownItem>Duplicate</DropdownItem>
    <DropdownItem variant="danger">Delete</DropdownItem>
  </DropdownMenu>
</Dropdown>
