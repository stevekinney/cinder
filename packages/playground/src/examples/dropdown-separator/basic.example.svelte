<script lang="ts" module>
  export const title = 'Dropdown separator';
  export const description = 'Separators divide menu item groups.';
</script>

<script lang="ts">
  import {
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownSeparator,
    DropdownTrigger,
  } from '../../../../components/src/index.ts';
</script>

<Dropdown id="separator-demo">
  <DropdownTrigger>More actions</DropdownTrigger>
  <DropdownMenu>
    <DropdownItem>Copy link</DropdownItem>
    <DropdownSeparator />
    <DropdownItem variant="danger">Delete</DropdownItem>
  </DropdownMenu>
</Dropdown>
