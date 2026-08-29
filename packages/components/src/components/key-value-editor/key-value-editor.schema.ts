import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    addLabel: {
      type: 'string',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'entries',
        reason: 'unknown-shape',
      },
      {
        name: 'onValueChange',
        reason: 'function-or-snippet',
      },
      {
        name: 'removeLabel',
        reason: 'function-or-snippet',
      },
      {
        name: 'secret',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
