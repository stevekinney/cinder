<script lang="ts" module>
  export const title = 'Basic dropdown';
  export const description = 'A button trigger with a list of menu items.';
</script>

<script lang="ts">
  import { Dropdown } from '@lostgradient/cinder/dropdown';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let dropdownId = $derived(`${mountIdPrefix ?? uid}-dropdown`);
</script>

<Dropdown id={dropdownId}>
  <Dropdown.Trigger>Options</Dropdown.Trigger>
  <Dropdown.Menu>
    <Dropdown.Item>Edit</Dropdown.Item>
    <Dropdown.Item>Duplicate</Dropdown.Item>
    <Dropdown.Item variant="danger">Delete</Dropdown.Item>
  </Dropdown.Menu>
</Dropdown>
