import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    ariaLabel: {
      type: 'string',
      description:
        'Accessible name for the <nav> landmark. Required, non-empty, distinct from other navs on the page.',
    },
  },
  additionalProperties: false,
  required: ['ariaLabel'],
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
