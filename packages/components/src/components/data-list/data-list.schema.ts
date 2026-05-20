import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'empty',
        reason: 'function-or-snippet',
      },
      {
        name: 'items',
        reason: 'generic-type-parameter',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
