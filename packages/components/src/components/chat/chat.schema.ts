import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        'Unique identifier used to scope accessibility attributes across the chat surface.',
    },
    isAtBottom: {
      type: 'boolean',
      description:
        'Whether the message viewport is scrolled to the bottom. Bindable; updated automatically as the user scrolls. Default `true`.',
    },
    unreadCount: {
      type: 'number',
      description:
        'Number of messages received while the viewport was scrolled away from the bottom. Bindable; resets to `0` when the user scrolls to the bottom. Default `0`.',
    },
    hasNewMessageIndicator: {
      type: 'boolean',
      description:
        'Whether the "new messages" indicator is currently visible above the composer. Bindable; cleared automatically when the viewport reaches the bottom. Default `false`.',
    },
    class: {
      type: 'string',
      description: 'Additional class name merged onto the `.chat-container` root element.',
    },
    surfaceMode: {
      enum: ['default', 'transparent'],
      description:
        "Controls the background of the chat surface. Use `'transparent'` to inherit the host element's background when embedding chat inside a card or panel. Default `'default'`.",
    },
    bottomThreshold: {
      type: 'number',
      description:
        'Distance in pixels from the bottom of the scroll viewport within which the chat is considered "at bottom" and will auto-scroll on new messages. Default `150`.',
    },
    jumpThreshold: {
      type: 'number',
      description:
        'Distance in pixels scrolled up from the bottom required before the jump-to-latest button appears. Must be greater than `bottomThreshold` to prevent button flickering. Default `200`.',
    },
    isStreaming: {
      type: 'boolean',
      description:
        'Whether a streaming response is currently in progress. When `true`, the composer is disabled and a stop-generating button is shown. Default `false`.',
    },
    streamingStatus: {
      type: 'string',
      description:
        'Optional status label displayed in the typing indicator while `isStreaming` is `true` and no streaming content has arrived yet (e.g. `"Thinking…"` or `"Analyzing file…"`). When omitted, three animated dots are shown.',
    },
    allowAttachments: {
      type: 'boolean',
      description:
        'Whether file attachments are enabled in the composer. When `false`, the attachment button is hidden and drag-and-drop onto the chat surface is suppressed. Default `true`.',
    },
    allowSearch: {
      type: 'boolean',
      description:
        'Whether in-conversation search is enabled. When `true`, pressing Ctrl+F / Cmd+F opens a search bar that highlights matching messages. Default `true`.',
    },
    virtualized: {
      type: 'boolean',
      description:
        'Use the virtualized message render path for long transcripts. The complete `ConversationHistory` remains unchanged; only the DOM window is reduced. Default `false`.',
    },
    virtualizationEstimatedRowHeight: {
      type: 'number',
      description: 'Estimated row height in pixels for virtualized message rows. Default `88`.',
    },
    virtualizationOverscan: {
      type: 'number',
      description:
        'Number of extra virtual rows rendered before and after the viewport. Default `3`.',
    },
    virtualizationInitialHeight: {
      type: 'number',
      description: 'Initial virtualized viewport height used before measurement. Default `640`.',
    },
    hasMoreHistory: {
      type: 'boolean',
      description:
        'Whether the explicit "Load earlier messages" trigger is shown when a load handler exists. Default `true`.',
    },
    loadEarlierLabel: {
      type: 'string',
      description: 'Label for the history pagination trigger. Default `"Load earlier messages"`.',
    },
    loadingEarlierLabel: {
      type: 'string',
      description:
        'Status text while older messages are loading. Default `"Loading earlier messages"`.',
    },
    allowCopy: {
      type: 'boolean',
      description:
        'Whether per-message copy buttons are shown in the message action bar. Default `true`.',
    },
    allowEditing: {
      type: 'boolean',
      description: 'Whether user messages can be edited inline. Default `true`.',
    },
    allowRetry: {
      type: 'boolean',
      description: 'Whether failed assistant messages show a retry button. Default `true`.',
    },
    emptyPrompts: {
      type: 'array',
      items: {
        type: 'string',
      },
      description:
        'List of suggested starter prompt strings shown as clickable buttons in the default empty state. Clicking a prompt submits it immediately as a user message. Has no effect when a custom `empty` snippet is provided.',
    },
  },
  additionalProperties: false,
  required: ['id'],
  metadata: {
    unsupportedProps: [
      {
        name: 'adapter',
        reason: 'unknown-shape',
        description:
          'Optional command/transport boundary around `conversation`. Its methods take\nprecedence over the matching callback props (e.g. `sendMessage` over\n`onsubmit`); omit it and Chat behaves exactly as with plain callbacks.',
      },
      {
        name: 'conversation',
        reason: 'unknown-shape',
        required: true,
        description:
          'The conversation transcript to render. Pass a {@link ConversationHistory}\nsnapshot; consumers holding a stateful conversation object pass its current\nsnapshot (e.g. `conversation.current`).',
      },
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
        name: 'messagePart',
        reason: 'function-or-snippet',
        description:
          'Per-message-part override. Replaces the rendering of an individual body part\n(markdown, tool call, tool result) while delegating the rest to the built-ins\nvia the `renderDefault` snippet it receives. Image parts are excluded — they\nrender through the grouped attachment grid, not this override.',
      },
      {
        name: 'messageStatus',
        reason: 'function-or-snippet',
      },
      {
        name: 'onadaptererror',
        reason: 'function-or-snippet',
        description:
          'Called when an adapter command fails — either a rejected promise or a synchronous throw from the method.',
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
        name: 'onloadhistory',
        reason: 'function-or-snippet',
        description:
          'Called when the explicit history trigger is activated. The consumer prepends compatible messages into `conversation`.',
      },
      {
        name: 'onpushmessage',
        reason: 'function-or-snippet',
        description:
          "Forwarded from the adapter's real-time `onMessage` push (consumer owns the transcript).",
      },
      {
        name: 'onreadreceipt',
        reason: 'function-or-snippet',
        description: "Forwarded from the adapter's real-time `onReadReceipt` push.",
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
        name: 'onsubmit',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontypingchange',
        reason: 'function-or-snippet',
        description: "Forwarded from the adapter's real-time `onTypingChange` push.",
      },
      {
        name: 'onunreadindicatorchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'row',
        reason: 'function-or-snippet',
        description:
          'Full-row override. Renders an entire message row; receives the message and\na `renderDefault` snippet for the built-in row (inversion of control), so a\nconsumer can wrap or fully replace specific rows.',
      },
      {
        name: 'viewportAttachment',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
