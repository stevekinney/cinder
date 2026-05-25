import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    min: {
      type: 'number',
      description: 'Minimum value. Default `0`.',
    },
    max: {
      type: 'number',
      description: 'Maximum value. Default `100`.',
    },
    step: {
      type: 'number',
      description: 'Step increment for arrow keys. Default `1`. Must be a positive finite number.',
    },
    pageStep: {
      type: 'number',
      description: 'Step increment for Page Up/Down. Default `step * 10`.',
    },
    label: {
      type: 'string',
      description: 'Visible label / accessible name for the slider. Required.',
    },
    ticks: {
      anyOf: [
        {
          const: false,
        },
        {
          const: true,
        },
        {
          type: 'array',
          items: {
            type: 'number',
          },
        },
      ],
      description:
        'Optional tick marks. `true` renders one per `step`; an array snaps to those values.',
    },
    disabled: {
      type: 'boolean',
      description: 'Disables interaction.',
    },
    name: {
      type: 'string',
      description: 'Form field name. Renders hidden inputs for form submission.',
    },
    class: {
      type: 'string',
      description: 'Extra class names merged with `.cinder-slider`.',
    },
    mode: {
      enum: ['single', 'range'],
    },
  },
  additionalProperties: false,
  required: ['label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'defaultValue',
        reason: 'unknown-shape',
      },
      {
        name: 'onchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'value',
        reason: 'unknown-shape',
      },
      {
        name: 'valueText',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
