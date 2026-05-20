import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: 'The code to render.',
    },
    language: {
      type: 'string',
      description: 'Optional language label rendered in the header.',
    },
    copyable: {
      type: 'boolean',
      description: 'When true, render a copy button in the header.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-code-block`.',
    },
  },
  additionalProperties: false,
  required: ['code'],
  metadata: {
    unsupportedProps: [
      {
        name: 'highlighter',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
