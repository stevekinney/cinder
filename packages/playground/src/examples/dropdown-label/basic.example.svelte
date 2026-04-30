<script lang="ts" module>
  export const title = 'Dropdown label';
  export const description = 'Labels group related menu actions without entering the tab order.';
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

<Dropdown id="label-demo">
  <DropdownTrigger>Grouped menu</DropdownTrigger>
  <DropdownMenu>
    <DropdownLabel>Document</DropdownLabel>
    <DropdownItem>Rename</DropdownItem>
    <DropdownItem>Move</DropdownItem>
  </DropdownMenu>
</Dropdown>
