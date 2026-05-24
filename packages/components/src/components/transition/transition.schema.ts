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
  metadata: {
    unsupportedProps: [
      {
        name: 'transition',
        reason: 'function-or-snippet',
      },
      {
        name: 'transitionParameters',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
