import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    variant: {
      enum: ['info', 'success', 'warning', 'error'],
      description: 'Visual style.',
      default: 'info',
    },
    dismissible: {
      type: 'boolean',
      description: 'Allow the alert to be dismissed.',
      default: false,
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-alert`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
