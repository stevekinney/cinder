import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'string',
      description: 'Identifier — matches the value of the corresponding Tab.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-tab-panel`.',
    },
  },
  additionalProperties: false,
  required: ['value'],
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
