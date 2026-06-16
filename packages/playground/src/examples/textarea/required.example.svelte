<script lang="ts" module>
  export const title = 'Required textarea';
  export const description =
    'Setting `required` forwards the native `required` attribute, which browsers expose as `aria-required="true"` and enforce during form submission.';
</script>

<script lang="ts">
  import { Textarea } from '@lostgradient/cinder/textarea';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-field`);

  let message = $state('');
</script>

<Textarea
  id={fieldId}
  bind:value={message}
  label="Message"
  description="This field is required."
  required
/>
