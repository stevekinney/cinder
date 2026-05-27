import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    open: {
      type: 'boolean',
    },
    anchorPoint: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
        },
        y: {
          type: 'number',
        },
      },
      additionalProperties: false,
      required: ['x', 'y'],
    },
    disabled: {
      type: 'boolean',
    },
    longPressDelay: {
      type: 'number',
    },
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
        name: 'onopenchange',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
