import type { ComponentSchema } from '../../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-timeline`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
