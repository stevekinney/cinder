import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    text: {
      type: 'string',
    },
    placement: {
      enum: ['top', 'right', 'bottom', 'left'],
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['text'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
