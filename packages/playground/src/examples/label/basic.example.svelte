<script lang="ts" module>
  export const title = 'Basic label';
  export const description = 'Standalone Label paired with an Input via for/id.';
</script>

<script lang="ts">
  import { Input, Label } from '../../../../components/src/index.ts';

  let value = $state('');
</script>

<div style="display: flex; flex-direction: column; gap: 0.4rem; max-width: 24rem;">
  <Label for="basic-name-input">Display name</Label>
  <Input id="basic-name-input" type="text" placeholder="e.g. Ada" bind:value />
</div>
