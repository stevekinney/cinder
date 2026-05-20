<script lang="ts" module>
  export const title = 'Split button composition';
  export const description =
    'A primary action button paired with a dropdown for related secondary actions. This is composition — ButtonGroup does no split-button work itself.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { ButtonGroup } from 'cinder/button-group';
  import { Dropdown } from 'cinder/dropdown';
  import { DropdownItem } from 'cinder/dropdown-item';
  import { DropdownMenu } from 'cinder/dropdown-menu';
  import { DropdownTrigger } from 'cinder/dropdown-trigger';
</script>

<ButtonGroup label="Save options">
  <Button>Save</Button>
  <Dropdown id="save-options">
    <DropdownTrigger aria-label="More save options" />
    <DropdownMenu>
      <DropdownItem>Save as draft</DropdownItem>
      <DropdownItem>Save and publish</DropdownItem>
      <DropdownItem variant="danger">Discard changes</DropdownItem>
    </DropdownMenu>
  </Dropdown>
</ButtonGroup>
