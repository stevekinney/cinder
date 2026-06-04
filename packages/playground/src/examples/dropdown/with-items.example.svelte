<script lang="ts" module>
  export const title = 'With clickable items';
  export const description =
    'Dropdown.Item accepts onclick handlers and a danger variant for destructive actions.';
</script>

<script lang="ts">
  import { Dropdown } from '@lostgradient/cinder/dropdown';
  let selected = $state('None');
</script>

<div style="display: grid; gap: 0.75rem;">
  <Dropdown id="dropdown-with-items">
    <Dropdown.Trigger>Document actions</Dropdown.Trigger>
    <Dropdown.Menu>
      <Dropdown.Item onclick={() => (selected = 'Copy link')}>Copy link</Dropdown.Item>
      <Dropdown.Item onclick={() => (selected = 'Duplicate')}>Duplicate</Dropdown.Item>
      <Dropdown.Item variant="danger" onclick={() => (selected = 'Delete')}>Delete</Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>
  <p style="margin: 0; color: var(--cinder-text-muted);">Selected: {selected}</p>
</div>
