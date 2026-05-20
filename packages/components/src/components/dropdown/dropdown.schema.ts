import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
    },
    class: {
      type: 'string',
    },
    open: {
      type: 'boolean',
    },
    placement: {
      enum: ['bottom-start', 'bottom-end'],
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
        name: 'trigger',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
