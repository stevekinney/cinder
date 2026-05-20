<script lang="ts" module>
  export const title = 'With group labels';
  export const description =
    'DropdownLabel groups related menu actions without entering the tab order.';
</script>

<script lang="ts">
  import { Dropdown } from 'cinder/dropdown';
  import { DropdownItem } from 'cinder/dropdown-item';
  import { DropdownLabel } from 'cinder/dropdown-label';
  import { DropdownMenu } from 'cinder/dropdown-menu';
  import { DropdownTrigger } from 'cinder/dropdown-trigger';
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
