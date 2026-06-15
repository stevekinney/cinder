import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    open: {
      type: 'boolean',
      description: 'Controls the open state of the context menu; bindable for controlled usage.',
    },
    anchorPoint: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
        },
        y: {
          type: 'number',
        },
      },
      additionalProperties: false,
      required: ['x', 'y'],
      description:
        'Explicit pointer coordinates at which to anchor the menu, overriding the position captured from the right-click or long-press event.',
    },
    disabled: {
      type: 'boolean',
      description:
        'When true, disables context-menu activation on right-click and long-press within the trigger region. Default `false`.',
    },
    longPressDelay: {
      type: 'number',
      description:
        'Duration in milliseconds a touch pointer must be held before the menu opens on mobile. Default `500`.',
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
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
