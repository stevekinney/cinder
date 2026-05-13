<script lang="ts" module>
  export const title = 'Split button composition';
  export const description =
    'A primary action button paired with a dropdown for related secondary actions. This is composition — ButtonGroup does no split-button work itself.';
</script>

<script lang="ts">
  import {
    Button,
    ButtonGroup,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
  } from '../../../../components/src/index.ts';
</script>

<ButtonGroup label="Save options">
  <Button>Save</Button>
  <Dropdown id="save-options">
    <DropdownTrigger>
      <!-- Decorative glyph; aria-label supplies the accessible name. -->
      <Button aria-label="More save options">▾</Button>
    </DropdownTrigger>
    <DropdownMenu>
      <DropdownItem>Save as draft</DropdownItem>
      <DropdownItem>Save and publish</DropdownItem>
      <DropdownItem variant="danger">Discard changes</DropdownItem>
    </DropdownMenu>
  </Dropdown>
</ButtonGroup>
