<script lang="ts" module>
  export const title = 'Live character counter';
  export const description =
    'Set `showCount` together with `maxlength` to render a live `{used}/{limit}` counter below the field that updates as the user types.';
</script>

<script lang="ts">
  import { Textarea } from '@lostgradient/cinder/textarea';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-field`);

  let summary = $state('A short product summary.');
</script>

<Textarea
  id={fieldId}
  bind:value={summary}
  label="Summary"
  description="Keep it under 200 characters."
  showCount
  maxlength={200}
/>
