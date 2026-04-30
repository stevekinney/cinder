<script lang="ts" module>
  export const title = 'Dropdown menu';
  export const description = 'The compound menu owns popover placement and menu keyboard handling.';
</script>

<script lang="ts">
  import {
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
  } from '../../../../components/src/index.ts';
</script>

<Dropdown id="menu-demo">
  <DropdownTrigger>Open menu</DropdownTrigger>
  <DropdownMenu>
    <DropdownItem>Preview</DropdownItem>
    <DropdownItem>Duplicate</DropdownItem>
  </DropdownMenu>
</Dropdown>
