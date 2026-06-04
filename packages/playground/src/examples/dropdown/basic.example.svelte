<script lang="ts" module>
  export const title = 'Basic dropdown';
  export const description = 'A button trigger with a list of menu items.';
</script>

<script lang="ts">
  import { Dropdown } from '@lostgradient/cinder/dropdown';
</script>

<Dropdown id="dropdown-basic">
  <Dropdown.Trigger>Options</Dropdown.Trigger>
  <Dropdown.Menu>
    <Dropdown.Item>Edit</Dropdown.Item>
    <Dropdown.Item>Duplicate</Dropdown.Item>
    <Dropdown.Item variant="danger">Delete</Dropdown.Item>
  </Dropdown.Menu>
</Dropdown>
