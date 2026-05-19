import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    variant: {
      enum: ['neutral', 'success', 'warning', 'danger', 'info', 'accent'],
      description: 'Visual style.',
      default: 'neutral',
    },
    size: {
      enum: ['xs', 'sm', 'md'],
      description: 'Size of the badge.',
      default: 'md',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-badge`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
