import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-quota-meter`.',
    },
    used: {
      type: 'number',
    },
    limit: {
      type: 'number',
    },
    unlimited: {
      type: 'boolean',
    },
    label: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['used'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'resetsAt',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
