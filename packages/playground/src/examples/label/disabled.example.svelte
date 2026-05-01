<script lang="ts" module>
  export const title = 'Disabled label';
  export const description = 'Disabled tone matches the disabled control it labels.';
</script>

<script lang="ts">
  import { Input, Label } from '../../../../components/src/index.ts';

  let value = $state('us-east-1');
</script>

<div style="display: flex; flex-direction: column; gap: 0.4rem; max-width: 24rem;">
  <Label for="disabled-input" disabled>Account region</Label>
  <Input id="disabled-input" type="text" disabled bind:value />
</div>
