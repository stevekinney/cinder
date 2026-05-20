import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    width: {
      type: 'string',
    },
    height: {
      type: 'string',
    },
    radius: {
      type: 'string',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
