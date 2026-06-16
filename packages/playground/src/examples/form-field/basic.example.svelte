<script lang="ts" module>
  export const title = 'Basic form field';
  export const description = 'A form field wrapping an input with label association.';
</script>

<script lang="ts">
  import { FormField } from '@lostgradient/cinder/form-field';
  import { Input } from '@lostgradient/cinder/input';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-full-name`);

  let name = $state('');
</script>

<FormField id={fieldId} label="Full name">
  <Input id={fieldId} bind:value={name} placeholder="Jane Smith" />
</FormField>
