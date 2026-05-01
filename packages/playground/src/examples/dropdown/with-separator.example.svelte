<script lang="ts" module>
  export const title = 'With separators';
  export const description =
    'DropdownSeparator divides menu item groups; useful before destructive actions.';
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

<Dropdown id="dropdown-with-separator">
  <DropdownTrigger>More actions</DropdownTrigger>
  <DropdownMenu>
    <DropdownItem>Copy link</DropdownItem>
    <DropdownItem>Duplicate</DropdownItem>
    <DropdownSeparator />
    <DropdownItem variant="danger">Delete</DropdownItem>
  </DropdownMenu>
</Dropdown>
