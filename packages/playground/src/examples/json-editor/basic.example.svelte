<script lang="ts" module>
  export const title = 'Controlled JSON editor';
  export const description =
    'A controlled JSON text field with optional lazy syntax highlighting and parse feedback.';
</script>

<script lang="ts">
  import { JsonEditor } from '@lostgradient/cinder/json-editor';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-payload`);
  let value = $state('{\n  "region": "us-west-2",\n  "dryRun": true\n}');
</script>

<JsonEditor
  id={fieldId}
  label="Request payload"
  description="Enter the JSON body sent with the request."
  {value}
  onValueChange={(nextValue) => (value = nextValue)}
  highlight={true}
/>
