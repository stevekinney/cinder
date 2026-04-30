<script lang="ts" module>
  export const title = 'With group labels';
  export const description =
    'DropdownLabel groups related menu actions without entering the tab order.';
</script>

<script lang="ts">
  import {
    Dropdown,
    DropdownItem,
    DropdownLabel,
    DropdownMenu,
    DropdownTrigger,
  } from '../../../../components/src/index.ts';
</script>

<Dropdown id="dropdown-with-label">
  <DropdownTrigger>Grouped menu</DropdownTrigger>
  <DropdownMenu>
    <DropdownLabel>Document</DropdownLabel>
    <DropdownItem>Rename</DropdownItem>
    <DropdownItem>Move</DropdownItem>
    <DropdownLabel>Sharing</DropdownLabel>
    <DropdownItem>Copy link</DropdownItem>
    <DropdownItem>Invite people</DropdownItem>
  </DropdownMenu>
</Dropdown>
