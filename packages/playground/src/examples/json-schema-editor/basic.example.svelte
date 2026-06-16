<script lang="ts" module>
  export const title = 'Basic JSON Schema editor';
  export const description = 'Edit a flat object schema with form, JSON, and diff views.';
</script>

<script lang="ts">
  import { JsonSchemaEditor } from '@lostgradient/cinder/json-schema-editor';
  import type { JsonSchemaValue } from '@lostgradient/cinder/json-schema-editor';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let jseId = $derived(`${mountIdPrefix ?? uid}-jse`);

  const personSchema: JsonSchemaValue = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Person',
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Full name', minLength: 1 },
      age: { type: 'integer', minimum: 0 },
      email: { type: 'string', format: 'email' },
    },
    required: ['name'],
  };
</script>

<JsonSchemaEditor id={jseId} schema={personSchema} />
