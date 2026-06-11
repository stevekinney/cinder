import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'string',
      description: 'Bound active tab value.',
    },
    orientation: {
      enum: ['horizontal', 'vertical'],
      description: 'Layout orientation. Affects which arrow keys move between tabs.',
    },
    activateOnFocus: {
      type: 'boolean',
      description:
        'When true (default for horizontal), focusing a tab also activates it\n(the panel updates immediately). Vertical defaults to manual activation\n— the user moves focus with arrows, then presses Enter or Space.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-tabs`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Tab and TabPanel children.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
