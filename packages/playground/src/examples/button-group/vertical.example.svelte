<script lang="ts" module>
  export const title = 'Vertical button group';
  export const description = 'Vertically stacked buttons with collapsed borders.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { ButtonGroup } from '@lostgradient/cinder/button-group';
</script>

<ButtonGroup label="Document actions" orientation="vertical">
  <Button variant="secondary">Save</Button>
  <Button variant="secondary">Duplicate</Button>
  <Button variant="secondary">Archive</Button>
</ButtonGroup>
