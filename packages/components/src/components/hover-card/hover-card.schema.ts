import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    open: {
      type: 'boolean',
      description: 'Controls the open state of the card; bindable for controlled usage.',
    },
    openDelay: {
      type: 'number',
      description:
        'Delay in milliseconds before the card opens after the pointer enters or focus lands on the trigger. Default `300`.',
    },
    closeDelay: {
      type: 'number',
      description:
        'Delay in milliseconds before the card closes after the pointer leaves and focus departs. Default `150`.',
    },
    placement: {
      enum: [
        'top',
        'top-start',
        'top-end',
        'right',
        'right-start',
        'right-end',
        'bottom',
        'bottom-start',
        'bottom-end',
        'left',
        'left-start',
        'left-end',
      ],
      description:
        'Preferred placement of the card relative to the trigger. Default `bottom-start`.',
    },
    offset: {
      type: 'number',
      description: 'Distance in pixels between the trigger and the card. Default `8`.',
    },
    showArrow: {
      type: 'boolean',
      description:
        'When true, renders a directional arrow pointing from the card toward the trigger. Default `false`.',
    },
    description: {
      type: 'string',
      description:
        'Visually hidden text wired to the trigger via aria-describedby for assistive technology context.',
    },
    class: {
      type: 'string',
      description: "Additional class names merged with the component's root class.",
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
      },
      {
        name: 'onopenchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'trigger',
        reason: 'function-or-snippet',
        required: true,
      },
      {
        name: 'triggerRef',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
