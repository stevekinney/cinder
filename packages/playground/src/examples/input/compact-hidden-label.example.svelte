<script lang="ts" module>
  export const title = 'Compact field with hidden label';
  export const description =
    'Keep the accessible name from label while visually hiding it for compact auth/token layouts.';
</script>

<script lang="ts">
  import { Input } from '@lostgradient/cinder/input';

  let token = $state('');
</script>

<Input
  id="demo-token"
  bind:value={token}
  label="Demo token"
  hideLabel
  autocomplete="off"
  placeholder="Enter demo token"
/>
