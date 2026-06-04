<script lang="ts" module>
  export const title = 'Invalid initial schema';
  export const description =
    'When the input cannot be parsed, the form is disabled and the JSON view is the entry point.';
</script>

<script lang="ts">
  import { JsonSchemaEditor } from '@lostgradient/cinder/json-schema-editor';
  const malformed = '{ "type": "not-a-real-type" }';
</script>

<JsonSchemaEditor id="invalid-jse" schema={malformed} />
