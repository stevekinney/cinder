import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    label: {
      type: 'string',
    },
    disabled: {
      type: 'boolean',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'onValueChange',
        reason: 'function-or-snippet',
      },
      {
        name: 'validate',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
