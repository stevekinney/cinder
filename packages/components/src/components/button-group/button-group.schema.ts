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
      description:
        'Inline accessible name for the group, applied as `aria-label`. Provide exactly one of `label` or `labelledBy`.',
    },
    labelledBy: {
      type: 'string',
      description:
        'The `id` of a visible heading element that already names the group, applied as `aria-labelledby`. Provide exactly one of `label` or `labelledBy`.',
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
