import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    conversation: {
      type: 'object',
    },
    isAtBottom: {
      type: 'boolean',
    },
    unreadCount: {
      type: 'number',
    },
    hasNewMessageIndicator: {
      type: 'boolean',
    },
    class: {
      type: 'string',
    },
    surfaceMode: {
      enum: ['default', 'transparent'],
    },
    bottomThreshold: {
      type: 'number',
    },
    jumpThreshold: {
      type: 'number',
    },
    isStreaming: {
      type: 'boolean',
    },
    streamingStatus: {
      type: 'string',
    },
    allowAttachments: {
      type: 'boolean',
    },
    allowSearch: {
      type: 'boolean',
    },
    allowCopy: {
      type: 'boolean',
    },
    allowEditing: {
      type: 'boolean',
    },
    allowRetry: {
      type: 'boolean',
    },
    emptyPrompts: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
  additionalProperties: false,
  required: ['conversation'],
  metadata: {
    unsupportedProps: [
      {
        name: 'empty',
        reason: 'function-or-snippet',
      },
      {
        name: 'header',
        reason: 'function-or-snippet',
      },
      {
        name: 'messageActions',
        reason: 'function-or-snippet',
      },
      {
        name: 'messageStatus',
        reason: 'function-or-snippet',
      },
      {
        name: 'onattachmentadd',
        reason: 'function-or-snippet',
      },
      {
        name: 'onattachmentfailure',
        reason: 'function-or-snippet',
      },
      {
        name: 'onattachmentremove',
        reason: 'function-or-snippet',
      },
      {
        name: 'onedit',
        reason: 'function-or-snippet',
      },
      {
        name: 'onexpandedchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onjumptolatest',
        reason: 'function-or-snippet',
      },
      {
        name: 'onretry',
        reason: 'function-or-snippet',
      },
      {
        name: 'onscrollstatechange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onstopgenerating',
        reason: 'function-or-snippet',
      },
      {
        name: 'onunreadindicatorchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'viewportAttachment',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
