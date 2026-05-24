<script lang="ts" module>
  export const title = 'With separators';
  export const description =
    'Dropdown.Separator divides menu item groups; useful before destructive actions.';
</script>

<script lang="ts">
  import { Dropdown } from 'cinder/dropdown';
</script>

<Dropdown id="dropdown-with-separator">
  <Dropdown.Trigger>More actions</Dropdown.Trigger>
  <Dropdown.Menu>
    <Dropdown.Item>Copy link</Dropdown.Item>
    <Dropdown.Item>Duplicate</Dropdown.Item>
    <Dropdown.Separator />
    <Dropdown.Item variant="danger">Delete</Dropdown.Item>
  </Dropdown.Menu>
</Dropdown>
