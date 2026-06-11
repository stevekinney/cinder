import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique identifier for the popover.',
    },
    open: {
      type: 'boolean',
      description: 'Whether the popover is visible.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-selection-popover`.',
    },
  },
  additionalProperties: false,
  required: ['id'],
  metadata: {
    unsupportedProps: [
      {
        name: 'oncancel',
        reason: 'function-or-snippet',
        description: 'Called when the composer is canceled.',
      },
      {
        name: 'onclose',
        reason: 'function-or-snippet',
        description: 'Called when the popover should close.',
      },
      {
        name: 'oncommentsubmit',
        reason: 'function-or-snippet',
        description: 'Called when a comment is submitted.',
      },
      {
        name: 'onexpand',
        reason: 'function-or-snippet',
        description: 'Called when the compact action expands into the composer.',
      },
      {
        name: 'position',
        reason: 'unknown-shape',
        required: true,
        description: 'Viewport-relative anchor point for the popover.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
