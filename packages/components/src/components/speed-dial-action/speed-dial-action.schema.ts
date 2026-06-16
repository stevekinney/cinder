import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Visible and accessible label for the action.',
    },
    disabled: {
      type: 'boolean',
      description: 'Disables the action and removes it from roving keyboard navigation.',
      default: false,
    },
    labelPlacement: {
      enum: ['auto', 'start', 'end', 'none'],
      description: 'Placement of the visible label relative to the action button.',
      default: 'auto',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-speed-dial-action`.',
    },
  },
  additionalProperties: false,
  required: ['label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'icon',
        reason: 'function-or-snippet',
        required: true,
        description: 'Icon or compact content rendered inside the action button.',
      },
      {
        name: 'onclick',
        reason: 'function-or-snippet',
        description: 'Called when the action is activated. The SpeedDial closes afterward.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
