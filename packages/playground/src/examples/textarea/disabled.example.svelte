<script lang="ts" module>
  export const title = 'Disabled textarea';
  export const description =
    'A disabled textarea is dimmed and non-editable; its value is still shown so context is preserved while editing is locked.';
</script>

<script lang="ts">
  import { Textarea } from '@lostgradient/cinder/textarea';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-field`);
</script>

<Textarea
  id={fieldId}
  value="This account note is read-only and managed by your administrator."
  label="Account note"
  description="Contact an administrator to change this."
  disabled
/>
