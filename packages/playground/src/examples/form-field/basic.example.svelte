<script lang="ts" module>
  export const title = 'Basic form field';
  export const description = 'A form field wrapping an input with label association.';
</script>

<script lang="ts">
  import { FormField } from 'cinder/form-field';
  import { Input } from 'cinder/input';
  let name = $state('');
</script>

<FormField id="full-name" label="Full name">
  <Input id="full-name" bind:value={name} placeholder="Jane Smith" />
</FormField>
