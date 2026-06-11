import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    orientation: {
      enum: ['horizontal', 'vertical'],
      description: "Orientation of the visual collapse. Default: 'horizontal'.",
    },
    class: {
      type: 'string',
      description: 'Additional class merged with `.cinder-button-group`.',
    },
    label: {
      type: 'string',
    },
    labelledBy: {
      type: 'string',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Buttons (or split-button compositions) to render inside the group.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
