<script lang="ts" module>
  export const title = 'Composition (oneOf)';
  export const description =
    'A schema using oneOf alongside type — both render as separate sections.';
</script>

<script lang="ts">
  import { JsonSchemaEditor } from 'cinder/json-schema-editor';
  import type { JsonSchemaValue } from 'cinder/json-schema-editor';
  const schema: JsonSchemaValue = {
    type: 'object',
    properties: {
      identifier: {
        oneOf: [
          { type: 'string', pattern: '^[a-z]+$' },
          { type: 'integer', minimum: 1 },
        ],
      },
    },
  };
</script>

<JsonSchemaEditor id="composition-jse" {schema} />
