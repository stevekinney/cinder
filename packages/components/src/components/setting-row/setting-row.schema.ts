import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
    },
    label: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
    warning: {
      type: 'string',
    },
    error: {
      type: 'string',
    },
    required: {
      type: 'boolean',
    },
    disabled: {
      type: 'boolean',
    },
    managed: {
      type: 'object',
      properties: {
        by: {
          type: 'string',
          description: 'Policy or administrator that owns the value.',
        },
        reason: {
          type: 'string',
          description: 'Human-readable explanation for the constraint.',
        },
      },
      additionalProperties: false,
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['id', 'label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'control',
        reason: 'function-or-snippet',
        required: true,
      },
      {
        name: 'disclosure',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
