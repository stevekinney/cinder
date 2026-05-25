import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    disabled: {
      type: 'boolean',
    },
    required: {
      type: 'boolean',
    },
    id: {
      type: 'string',
    },
    value: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
    defaultValue: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
    min: {
      type: 'number',
    },
    max: {
      type: 'number',
    },
    step: {
      type: 'number',
    },
    locale: {
      type: 'string',
    },
    name: {
      type: 'string',
    },
    label: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
    error: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['id'],
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
        reason: 'unknown-shape',
      },
      {
        name: 'format',
        reason: 'unknown-shape',
      },
      {
        name: 'onchange',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
