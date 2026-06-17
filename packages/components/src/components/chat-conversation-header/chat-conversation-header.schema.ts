import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    headingLevel: {
      enum: [2, 3, 4],
      description: 'Heading level for the conversation title. Default `2`.',
    },
    showExportActions: {
      type: 'boolean',
      description: 'Whether to render the built-in conversation export actions. Default `true`.',
    },
    class: {
      type: 'string',
      description: 'Additional class name merged with `.cinder-chat-conversation-header`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
        description: 'Additional action controls rendered after the built-in export actions.',
      },
      {
        name: 'conversation',
        reason: 'unknown-shape',
        required: true,
        description: 'Active compatible conversation snapshot.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
