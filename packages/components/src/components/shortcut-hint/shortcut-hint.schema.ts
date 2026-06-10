import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    keys: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'The key sequence to display.',
    },
    keysLabel: {
      type: 'string',
      description: 'Accessible label for the key combo.',
    },
    keysPosition: {
      enum: ['before', 'after'],
      description: 'Position of keys relative to children.',
      default: 'after',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-shortcut-hint`.',
    },
  },
  additionalProperties: false,
  required: ['keys'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
