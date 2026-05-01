<script lang="ts" module>
  export const title = 'Basic label';
  export const description = 'Standalone Label paired with a native input via for/id.';
</script>

<script lang="ts">
  import { Label } from '../../../../components/src/index.ts';
</script>

<div style="display: flex; flex-direction: column; gap: 0.4rem; max-width: 24rem;">
  <Label for="basic-name-input">Display name</Label>
  <input
    id="basic-name-input"
    type="text"
    placeholder="e.g. Ada"
    style="padding: 0.4rem 0.6rem; border: 1px solid #c8c8c8; border-radius: 4px;"
  />
</div>
