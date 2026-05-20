<script lang="ts" module>
  export const title = 'Basic button group';
  export const description =
    'Horizontal layout container with border-collapsed buttons. Use consistent variants across children.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { ButtonGroup } from 'cinder/button-group';
</script>

<ButtonGroup label="Document actions">
  <Button variant="secondary">Save</Button>
  <Button variant="secondary">Duplicate</Button>
  <Button variant="secondary">Archive</Button>
</ButtonGroup>
