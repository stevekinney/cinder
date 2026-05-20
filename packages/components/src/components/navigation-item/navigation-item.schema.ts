import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    active: {
      type: 'boolean',
    },
    disabled: {
      type: 'boolean',
    },
    class: {
      type: 'string',
    },
    variant: {
      enum: ['horizontal', 'mobile'],
      description:
        "Controls stacked layout on mobile. Emitted as data-variant. Default 'horizontal'.",
    },
  },
  additionalProperties: false,
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
