<script lang="ts" module>
  export const title = 'Dropdown trigger';
  export const description = 'The compound trigger wires menu ARIA attributes automatically.';
</script>

<script lang="ts">
  import {
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
  } from '../../../../components/src/index.ts';
</script>

<Dropdown id="trigger-demo">
  <DropdownTrigger>Actions</DropdownTrigger>
  <DropdownMenu>
    <DropdownItem>Copy link</DropdownItem>
  </DropdownMenu>
</Dropdown>
