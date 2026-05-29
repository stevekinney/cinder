import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    initialDepth: {
      type: 'number',
      description: 'Initial collapse depth. Nodes deeper than this start collapsed. Default 1.',
    },
    maxDepth: {
      type: 'number',
      description:
        'Hard depth cap. Nodes deeper than this never render their children. Default 50.',
    },
    maxBytes: {
      type: 'number',
      description: 'Hard byte cap on the serialized payload. Default 1_048_576 (1 MB).',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-json-viewer`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'value',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
