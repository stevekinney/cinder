import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
    },
    reason: {
      type: 'string',
    },
    source: {
      type: 'string',
    },
    scope: {
      type: 'string',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['id', 'reason'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
