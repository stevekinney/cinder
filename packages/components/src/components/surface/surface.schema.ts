import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    tone: {
      enum: ['default', 'raised', 'inset', 'transparent'],
      description: 'Surface tone.',
      default: 'default',
    },
    class: {
      type: 'string',
      description: 'Additional CSS classes',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Content rendered inside the surface container.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
