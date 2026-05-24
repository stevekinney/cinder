import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    show: {
      type: 'boolean',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['show'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
