<script lang="ts" module>
  export const title = 'Composition (oneOf)';
  export const description =
    'A schema using oneOf alongside type — both render as separate sections.';
</script>

<script lang="ts">
  import { JsonSchemaEditor } from '../../../../components/src/index.ts';

  const schema = {
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
