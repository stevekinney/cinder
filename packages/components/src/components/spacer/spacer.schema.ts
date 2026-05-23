import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    as: {
      type: 'string',
      description: 'Rendered HTML tag.',
      default: 'span',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-spacer`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
