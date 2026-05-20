import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    href: {
      type: 'string',
    },
    rel: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
      },
      {
        name: 'class',
        reason: 'unknown-shape',
      },
      {
        name: 'image',
        reason: 'function-or-snippet',
      },
      {
        name: 'meta',
        reason: 'function-or-snippet',
      },
      {
        name: 'subtitle',
        reason: 'function-or-snippet',
      },
      {
        name: 'target',
        reason: 'unknown-shape',
      },
      {
        name: 'title',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
