import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Visible panel title.',
    },
    status: {
      enum: ['idle', 'loading', 'ready', 'warning', 'error', 'empty'],
      description: 'Status taxonomy for the preview surface.',
      default: 'idle',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-preview-panel`.',
    },
  },
  additionalProperties: false,
  required: ['title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
        description: 'Action controls rendered in the header.',
      },
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Main preview content.',
      },
      {
        name: 'footer',
        reason: 'function-or-snippet',
        description: 'Footer content such as metadata or secondary controls.',
      },
      {
        name: 'leading',
        reason: 'function-or-snippet',
        description: 'Leading visual or control rendered before the title.',
      },
      {
        name: 'tabs',
        reason: 'function-or-snippet',
        description: 'Tab controls rendered below the header.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
