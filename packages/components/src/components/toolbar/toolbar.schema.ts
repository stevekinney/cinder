import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    orientation: {
      enum: ['horizontal', 'vertical'],
      description: 'Layout direction for keyboard ownership and separator placement.',
      default: 'horizontal',
    },
    class: {
      type: 'string',
      description: 'Additional class merged with `.cinder-toolbar`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
