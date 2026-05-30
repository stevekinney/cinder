import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    role: {
      enum: ['user', 'assistant', 'system'],
      description: 'Role of the speaker — drives visual treatment.',
    },
    time: {
      type: 'string',
      description: 'Optional timestamp string rendered in the header.',
    },
    name: {
      type: 'string',
      description: 'Optional speaker name override (defaults derived from role).',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-message`.',
    },
  },
  additionalProperties: false,
  required: ['role'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
