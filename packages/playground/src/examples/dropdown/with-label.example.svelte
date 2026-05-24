<script lang="ts" module>
  export const title = 'With group labels';
  export const description =
    'Dropdown.Group and Dropdown.Label expose accessible group boundaries for related menu actions.';
</script>

<script lang="ts">
  import { Dropdown } from 'cinder/dropdown';
</script>

<Dropdown id="dropdown-with-label">
  <Dropdown.Trigger>Grouped menu</Dropdown.Trigger>
  <Dropdown.Menu>
    <Dropdown.Group labelledBy="dropdown-with-label-document">
      <Dropdown.Label id="dropdown-with-label-document">Document</Dropdown.Label>
      <Dropdown.Item>Rename</Dropdown.Item>
      <Dropdown.Item>Move</Dropdown.Item>
    </Dropdown.Group>
    <Dropdown.Group labelledBy="dropdown-with-label-sharing">
      <Dropdown.Label id="dropdown-with-label-sharing">Sharing</Dropdown.Label>
      <Dropdown.Item>Copy link</Dropdown.Item>
      <Dropdown.Item>Invite people</Dropdown.Item>
    </Dropdown.Group>
  </Dropdown.Menu>
</Dropdown>
