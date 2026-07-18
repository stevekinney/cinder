import type { ComponentSchema } from '../../schema-types.ts';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    activeConversationId: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description: 'Currently active conversation id.',
    },
    ariaLabel: {
      type: 'string',
      description:
        'Accessible name for the conversations navigation landmark. Default `"Conversations"`.',
    },
    emptyText: {
      type: 'string',
      description:
        'Empty state text when no conversations are present. Default `"No conversations"`.',
    },
    class: {
      type: 'string',
      description: 'Additional class name merged with `.cinder-chat-conversation-list`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'conversations',
        reason: 'unknown-shape',
        required: true,
        description:
          'Conversation summaries to render. Sorts by latest message/update time descending.',
      },
      {
        name: 'onselectconversation',
        reason: 'function-or-snippet',
        description: 'Called when a conversation is selected.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
