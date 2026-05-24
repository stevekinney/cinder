import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    target: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    disabled: {
      type: 'boolean',
    },
    class: {
      type: 'string',
    },
    inheritAttributes: {
      type: 'boolean',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
