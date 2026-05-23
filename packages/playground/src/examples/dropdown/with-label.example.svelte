<script lang="ts" module>
  export const title = 'With group labels';
  export const description =
    'DropdownGroup and DropdownLabel expose accessible group boundaries for related menu actions.';
</script>

<script lang="ts">
  import { Dropdown } from 'cinder/dropdown';
  import { DropdownGroup } from 'cinder/dropdown-group';
  import { DropdownItem } from 'cinder/dropdown-item';
  import { DropdownLabel } from 'cinder/dropdown-label';
  import { DropdownMenu } from 'cinder/dropdown-menu';
  import { DropdownTrigger } from 'cinder/dropdown-trigger';
</script>

<Dropdown id="dropdown-with-label">
  <DropdownTrigger>Grouped menu</DropdownTrigger>
  <DropdownMenu>
    <DropdownGroup labelledBy="dropdown-with-label-document">
      <DropdownLabel id="dropdown-with-label-document">Document</DropdownLabel>
      <DropdownItem>Rename</DropdownItem>
      <DropdownItem>Move</DropdownItem>
    </DropdownGroup>
    <DropdownGroup labelledBy="dropdown-with-label-sharing">
      <DropdownLabel id="dropdown-with-label-sharing">Sharing</DropdownLabel>
      <DropdownItem>Copy link</DropdownItem>
      <DropdownItem>Invite people</DropdownItem>
    </DropdownGroup>
  </DropdownMenu>
</Dropdown>
