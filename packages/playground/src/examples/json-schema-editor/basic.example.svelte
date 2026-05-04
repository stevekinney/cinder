<script lang="ts" module>
  export const title = 'Basic JSON Schema editor';
  export const description = 'Edit a flat object schema with form, JSON, and diff views.';
</script>

<script lang="ts">
  import { JsonSchemaEditor } from '../../../../components/src/index.ts';

  const personSchema = {
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

<JsonSchemaEditor id="basic-jse" schema={personSchema} />
