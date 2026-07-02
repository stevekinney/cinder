<script lang="ts" module>
  export const title = 'Placement';
  export const description =
    'Use bottom-start or bottom-end placement to align the menu with whichever trigger edge fits the surrounding layout.';
</script>

<script lang="ts">
  import { Dropdown } from '@lostgradient/cinder/dropdown';
</script>

<div class="example-preview-row">
  <Dropdown id="dropdown-placement-bottom-start" placement="bottom-start">
    <Dropdown.Trigger>Bottom-start</Dropdown.Trigger>
    <Dropdown.Menu>
      <Dropdown.Item>Aligned to the left edge</Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>

  <Dropdown id="dropdown-placement-bottom-end" placement="bottom-end">
    <Dropdown.Trigger>Bottom-end</Dropdown.Trigger>
    <Dropdown.Menu>
      <Dropdown.Item>Aligned to the right edge</Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>
</div>
