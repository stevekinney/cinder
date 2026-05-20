import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
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
    format: {
      type: 'object',
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
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
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
