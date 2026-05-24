import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    active: {
      type: 'boolean',
    },
    restoreFocus: {
      type: 'boolean',
    },
    initialFocus: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    fallbackFocus: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
