import type { ComponentSchema } from '../../schema-types.ts';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'messages',
        reason: 'unknown-shape',
        required: true,
      },
      {
        name: 'onNavigate',
        reason: 'function-or-snippet',
        description:
          'Scroll a message index; callers should delegate to ChatVirtualizer when present.',
      },
      {
        name: 'preview',
        reason: 'function-or-snippet',
      },
      {
        name: 'scrollToIndex',
        reason: 'function-or-snippet',
        description: 'Optional virtualizer bridge; implementations should use center alignment.',
      },
      {
        name: 'scrollToMessage',
        reason: 'function-or-snippet',
        description:
          'Message-aware Chat bridge; resolves virtualized and grouped rows before centering.',
      },
      {
        name: 'viewport',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
