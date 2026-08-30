import type { ComponentSchema } from '../../schema-types.ts';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    live: {
      type: 'boolean',
      description: 'Keeps the child transcript visually active while its owner is running.',
    },
    label: {
      type: 'string',
      description: 'Optional label for the nested transcript landmark.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'conversation',
        reason: 'unknown-shape',
        required: true,
      },
      {
        name: 'row',
        reason: 'function-or-snippet',
        description: 'Render a custom row while retaining the child transcript shell.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
