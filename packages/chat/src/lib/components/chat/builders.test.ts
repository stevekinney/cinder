import { describe, expect, test } from 'bun:test';

import {
  appendAssistantMessage,
  appendMessages,
  appendUserMessage,
  createConversation,
} from './builders.ts';
import type {
  ConversationEnvironment,
  ConversationHistory,
  JSONValue,
  Message,
  MessageInput,
  MultiModalContent,
} from './conversation-model.ts';

describe('chat conversation builders', () => {
  test('createConversation builds an empty compatible conversation snapshot', () => {
    const conversation = createConversation({
      id: 'conversation-builders',
      title: 'Builder coverage',
      status: 'archived',
    });

    expect(conversation).toMatchObject({
      schemaVersion: 4,
      id: 'conversation-builders',
      title: 'Builder coverage',
      status: 'archived',
      metadata: {},
      ids: [],
      messages: {},
    });
    expect(Date.parse(conversation.createdAt)).not.toBeNaN();
    expect(conversation.updatedAt).toBe(conversation.createdAt);
  });

  test('createConversation copies nested metadata before storing it', () => {
    const metadata = {
      steps: [{ title: 'Draft' }],
    };
    const conversation = createConversation({
      id: 'conversation-metadata-copy',
      metadata,
    });

    metadata.steps[0]!.title = 'Mutated';
    metadata.steps.push({ title: 'Added later' });

    expect(conversation.metadata).toEqual({ steps: [{ title: 'Draft' }] });
  });

  test('createConversation rejects malformed boundary fields', () => {
    expect(() =>
      createConversation({ id: 1 } as unknown as Parameters<typeof createConversation>[0]),
    ).toThrow('conversation id must be a string');

    expect(() =>
      createConversation({ id: 'conversation-invalid-generated-id' }, {
        randomId: () => 1,
      } as unknown as Partial<ConversationEnvironment>),
    ).not.toThrow();

    expect(() =>
      createConversation(undefined, {
        randomId: () => 1,
      } as unknown as Partial<ConversationEnvironment>),
    ).toThrow('conversation id must be a string');

    expect(() =>
      createConversation({ title: 1 } as unknown as Parameters<typeof createConversation>[0]),
    ).toThrow('conversation title must be a string');

    expect(() =>
      createConversation({ status: 'paused' } as unknown as Parameters<
        typeof createConversation
      >[0]),
    ).toThrow('conversation status must be active, archived, or deleted');

    expect(() =>
      createConversation(undefined, {
        now: () => 1,
      } as unknown as Partial<ConversationEnvironment>),
    ).toThrow('conversation timestamp must be a string');
  });

  test('appendMessages is immutable and preserves the original snapshot when no inputs are given', () => {
    const conversation = createConversation({ id: 'conversation-noop' });

    expect(appendMessages(conversation)).toBe(conversation);

    const updated = appendMessages(conversation, {
      role: 'assistant',
      content: 'Hello from the assistant',
    });

    expect(updated).not.toBe(conversation);
    expect(conversation.ids).toEqual([]);
    expect(conversation.messages).toEqual({});
    expect(updated.ids).toHaveLength(1);
    expect(updated.messages[updated.ids[0]!]?.position).toBe(0);
  });

  test('appendMessages materializes metadata, tool fields, and copied multi-modal content', () => {
    const content: MultiModalContent[] = [
      { type: 'text', text: 'Inspect this image' },
      { type: 'image', url: 'https://example.com/image.png' },
    ];
    const conversation = appendMessages(createConversation({ id: 'conversation-tools' }), {
      role: 'tool-call',
      content,
      metadata: { source: 'builder-test' },
      toolCall: {
        id: 'call-1',
        name: 'inspect_image',
        arguments: { depth: 'full' },
      },
      tokenUsage: {
        prompt: 7,
        completion: 11,
        total: 18,
      },
    });

    const message = conversation.messages[conversation.ids[0]!]!;
    content.push({ type: 'text', text: 'Added after append' });

    expect(message.content).toEqual([
      { type: 'text', text: 'Inspect this image' },
      { type: 'image', url: 'https://example.com/image.png' },
    ]);
    expect(message.metadata).toEqual({ source: 'builder-test' });
    expect(message.toolCall?.id).toBe('call-1');
    expect(message.tokenUsage?.total).toBe(18);
    expect(message.hidden).toBe(false);
  });

  test('appendMessages accepts supported reasoning and tool content parts', () => {
    const content: MultiModalContent[] = [
      { type: 'thinking', thinking: 'Plan the response', signature: 'signed-thinking' },
      { type: 'redacted_thinking', data: 'sealed' },
      { type: 'server_tool_use', id: 'tool-use-1', name: 'web_search', input: {} },
      {
        type: 'web_search_tool_result',
        tool_use_id: 'tool-use-1',
        content: [{ title: 'Cinder documentation' }],
      },
      { type: 'container_upload', file_id: 'file-123' },
    ];

    const conversation = appendMessages(createConversation({ id: 'conversation-content-parts' }), {
      role: 'assistant',
      content,
    });

    expect(conversation.messages[conversation.ids[0]!]!.content).toEqual(content);
  });

  test('appendMessages copies nested message metadata before storing it', () => {
    const metadata = {
      steps: [{ title: 'Draft' }],
    };
    const conversation = appendMessages(createConversation({ id: 'conversation-message-copy' }), {
      role: 'assistant',
      content: 'Here is the draft',
      metadata,
    });
    const message = conversation.messages[conversation.ids[0]!]!;

    metadata.steps[0]!.title = 'Mutated';
    metadata.steps.push({ title: 'Added later' });

    expect(message.metadata).toEqual({ steps: [{ title: 'Draft' }] });
  });

  test('appendMessages rejects non-JSON transcript payloads before storing them', () => {
    const conversation = createConversation({ id: 'conversation-json-boundary' });

    expect(() =>
      createConversation({
        id: 'conversation-invalid-metadata',
        metadata: { cost: 1n } as unknown as Record<string, JSONValue>,
      }),
    ).toThrow('metadata must be a JSON-compatible object');

    expect(() =>
      appendMessages(conversation, {
        role: 'assistant',
        content: 'Invalid metadata',
        metadata: ['not', 'an', 'object'] as unknown as Record<string, JSONValue>,
      }),
    ).toThrow('metadata must be a JSON-compatible object');

    expect(() =>
      appendMessages(conversation, {
        role: 'assistant',
        content: {
          type: 'text',
          text: 'Invalid',
          createdAt: new Date(),
        } as unknown as MessageInput['content'],
      }),
    ).toThrow('appendMessages expected MessageInput arguments before the optional environment');

    expect(() =>
      appendMessages(conversation, {
        role: 'assistant',
        content: [null] as unknown as MessageInput['content'],
      }),
    ).toThrow('appendMessages expected MessageInput arguments before the optional environment');

    expect(() =>
      appendMessages(conversation, {
        role: 'assistant',
        content: {
          type: 'unsupported',
        } as unknown as MessageInput['content'],
      }),
    ).toThrow('appendMessages expected MessageInput arguments before the optional environment');

    expect(() =>
      appendMessages(conversation, {
        role: 'tool-call',
        content: '',
        toolCall: {
          id: 'call-invalid',
          name: 'lookup',
          arguments: new Map([['package', '@lostgradient/cinder']]),
        } as unknown as MessageInput['toolCall'],
      }),
    ).toThrow('toolCall must be a JSON-compatible object');
  });

  test('appendMessages rejects invalid token usage before storing it', () => {
    const conversation = createConversation({ id: 'conversation-invalid-token-usage' });

    expect(() =>
      appendMessages(conversation, {
        role: 'assistant',
        content: 'Invalid token usage',
        tokenUsage: { prompt: Number.NaN, completion: 1, total: 1 } as MessageInput['tokenUsage'],
      }),
    ).toThrow('tokenUsage must be a JSON-compatible object');

    expect(() =>
      appendMessages(conversation, {
        role: 'assistant',
        content: 'Invalid token usage',
        tokenUsage: { total: 1n } as unknown as MessageInput['tokenUsage'],
      }),
    ).toThrow('tokenUsage must be a JSON-compatible object');

    expect(() =>
      appendMessages(conversation, {
        role: 'assistant',
        content: 'Invalid token usage',
        tokenUsage: { total: '1' } as unknown as MessageInput['tokenUsage'],
      }),
    ).toThrow('tokenUsage values must be numbers');

    expect(() =>
      appendMessages(conversation, {
        role: 'assistant',
        content: 'Invalid token usage',
        tokenUsage: { prompt: -1, completion: 0.5, total: -0.5 },
      }),
    ).toThrow('tokenUsage values must be non-negative integers');
  });

  test('appendMessages copies appended tool payloads before storing them', () => {
    const toolCall = {
      id: 'call-copy',
      name: 'lookup',
      arguments: { package: '@lostgradient/cinder' },
    };
    const toolResult = {
      callId: 'call-copy',
      outcome: 'success' as const,
      content: { found: true },
    };
    const tokenUsage = {
      prompt: 1,
      completion: 2,
      total: 3,
    };

    const conversation = appendMessages(
      createConversation({ id: 'conversation-copy-payloads' }),
      { role: 'tool-call', content: '', toolCall, tokenUsage },
      { role: 'tool-result', content: '', toolResult },
    );

    toolCall.arguments.package = 'mutated';
    toolResult.content.found = false;
    tokenUsage.total = 99;

    const [callMessageId, resultMessageId] = conversation.ids;
    const callMessage = conversation.messages[callMessageId!]!;
    const resultMessage = conversation.messages[resultMessageId!]!;

    expect(callMessage.toolCall?.arguments).toEqual({ package: '@lostgradient/cinder' });
    expect(callMessage.tokenUsage?.total).toBe(3);
    expect(resultMessage.toolResult?.content).toEqual({ found: true });
  });

  test('appendMessages normalizes a single content part before storing it', () => {
    const content = { type: 'text', text: 'Single content part' } satisfies MultiModalContent;
    const input = {
      role: 'assistant',
      content,
    } as unknown as MessageInput;

    const conversation = appendMessages(
      createConversation({ id: 'conversation-single-part' }),
      input,
    );
    const message = conversation.messages[conversation.ids[0]!]!;

    expect(message.content).toEqual([{ type: 'text', text: 'Single content part' }]);
  });

  test('appendMessages accepts Cinder-style tool-call and tool-result transcripts', () => {
    const conversation = appendMessages(
      createConversation({ id: 'conversation-tool-transcript' }),
      {
        role: 'tool-call',
        content: '',
        toolCall: { id: 'call-1', name: 'lookup', arguments: { package: '@lostgradient/cinder' } },
      },
      {
        role: 'tool-result',
        content: '',
        toolResult: { callId: 'call-1', outcome: 'success', content: { found: true } },
      },
    );

    const [callMessageId, resultMessageId] = conversation.ids;
    const callMessage = conversation.messages[callMessageId!]!;
    const resultMessage = conversation.messages[resultMessageId!]!;

    expect(callMessage.role).toBe('tool-call');
    expect(callMessage.toolCall?.id).toBe('call-1');
    expect(resultMessage.role).toBe('tool-result');
    expect(resultMessage.toolResult?.callId).toBe('call-1');
  });

  test('appendMessages rejects invalid tool transcripts before appending', () => {
    const conversation = createConversation({ id: 'conversation-invalid-tools' });

    expect(() =>
      appendMessages(conversation, {
        role: 'tool-result',
        content: '',
        toolResult: { callId: 'missing-call', outcome: 'success', content: null },
      }),
    ).toThrow('tool result references non-existent tool-call: missing-call');

    expect(() =>
      appendMessages(
        conversation,
        {
          role: 'tool-call',
          content: '',
          toolCall: { id: 'duplicate-call', name: 'lookup', arguments: {} },
        },
        {
          role: 'tool-call',
          content: '',
          toolCall: { id: 'duplicate-call', name: 'lookup_again', arguments: {} },
        },
      ),
    ).toThrow('duplicate toolCall.id in conversation: duplicate-call');

    const duplicateExistingToolCallConversation = appendMessages(conversation, {
      role: 'tool-call',
      content: '',
      toolCall: { id: 'existing-duplicate-call', name: 'lookup', arguments: {} },
    }) as ConversationHistory & { ids: string[]; messages: Record<string, Message> };
    const originalMessageId = duplicateExistingToolCallConversation.ids[0]!;
    const duplicateMessageId = `${originalMessageId}-copy`;
    duplicateExistingToolCallConversation.ids.push(duplicateMessageId);
    duplicateExistingToolCallConversation.messages[duplicateMessageId] = {
      ...duplicateExistingToolCallConversation.messages[originalMessageId]!,
      id: duplicateMessageId,
      position: 1,
    };

    expect(() =>
      appendMessages(duplicateExistingToolCallConversation, {
        role: 'assistant',
        content: 'Next',
      }),
    ).toThrow('duplicate toolCall.id in conversation: existing-duplicate-call');

    expect(() =>
      appendMessages(conversation, {
        role: 'tool-call',
        content: '',
        toolCall: { name: 'missing_id', arguments: {} } as unknown as MessageInput['toolCall'],
      }),
    ).toThrow('toolCall must include string id, string name, and JSON arguments');

    const validToolCallConversation = appendMessages(conversation, {
      role: 'tool-call',
      content: '',
      toolCall: { id: 'call-with-invalid-result', name: 'lookup', arguments: {} },
    });

    expect(() =>
      appendMessages(validToolCallConversation, {
        role: 'tool-result',
        content: '',
        toolResult: {
          callId: 'call-with-invalid-result',
          outcome: 'invalid',
          content: null,
        } as unknown as MessageInput['toolResult'],
      }),
    ).toThrow('toolResult must include string callId, valid outcome, and JSON content');
  });

  test('appendMessages rejects malformed inputs instead of silently dropping them', () => {
    const conversation = createConversation({ id: 'conversation-malformed-inputs' });

    expect(() => appendMessages(conversation, { role: 'user' } as unknown as MessageInput)).toThrow(
      'appendMessages expected MessageInput arguments before the optional environment',
    );

    expect(() =>
      appendMessages(conversation, undefined as unknown as MessageInput, {
        role: 'assistant',
        content: 'Still invalid',
      }),
    ).toThrow('appendMessages expected MessageInput arguments before the optional environment');

    expect(() =>
      appendMessages(conversation, {
        role: 'assistant',
        content: 'Invalid hidden flag',
        hidden: 'false',
      } as unknown as MessageInput),
    ).toThrow('appendMessages expected MessageInput arguments before the optional environment');
  });

  test('appendMessages rejects generated message identifier collisions', () => {
    const conversation = createConversation({ id: 'conversation-duplicate-message-ids' });
    const environment = {
      randomId: () => 'duplicate-message',
    } satisfies Partial<ConversationEnvironment>;

    expect(() =>
      appendMessages(
        conversation,
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Second' },
        environment,
      ),
    ).toThrow('duplicate message id in conversation: duplicate-message');

    const firstConversation = appendMessages(
      conversation,
      { role: 'user', content: 'First' },
      environment,
    );

    expect(() =>
      appendMessages(firstConversation, { role: 'assistant', content: 'Second' }, environment),
    ).toThrow('duplicate message id in conversation: duplicate-message');

    expect(() =>
      appendMessages(conversation, { role: 'user', content: 'Bad id' }, {
        randomId: () => 1,
      } as unknown as Partial<ConversationEnvironment>),
    ).toThrow('generated message id must be a string');
  });

  test('appendMessages validates plugin output before storing it', () => {
    const conversation = createConversation({ id: 'conversation-invalid-plugin-output' });
    const environment = {
      plugins: [
        (input) =>
          ({
            ...input,
            hidden: 'false',
          }) as unknown as MessageInput,
      ],
    } satisfies Partial<ConversationEnvironment>;

    expect(() =>
      appendMessages(conversation, { role: 'assistant', content: 'Hello' }, environment),
    ).toThrow('conversation plugin returned an invalid MessageInput');
  });

  test('appendMessages rejects malformed environment timestamps', () => {
    const conversation = createConversation({ id: 'conversation-invalid-timestamp' });

    expect(() =>
      appendMessages(conversation, { role: 'assistant', content: 'Hello' }, {
        now: () => 1,
      } as unknown as Partial<ConversationEnvironment>),
    ).toThrow('conversation timestamp must be a string');
  });

  test('role-specific append helpers preserve order and assign positions', () => {
    const conversation = appendAssistantMessage(
      appendUserMessage(createConversation({ id: 'conversation-roles' }), 'Hi'),
      'Hello',
    );

    const [firstMessageId, secondMessageId] = conversation.ids;
    const firstMessage = conversation.messages[firstMessageId!]!;
    const secondMessage = conversation.messages[secondMessageId!]!;

    expect(firstMessage.role).toBe('user');
    expect(firstMessage.position).toBe(0);
    expect(secondMessage.role).toBe('assistant');
    expect(secondMessage.position).toBe(1);
    expect(firstMessage.id).not.toBe(secondMessage.id);
  });

  test('role-specific append helpers preserve Conversationalist environment overloads', () => {
    let nextId = 0;
    const environment = {
      now: () => '2026-07-09T00:00:00.000Z',
      randomId: () => `fixed-${(nextId += 1)}`,
      plugins: [
        (input) => ({
          ...input,
          metadata: { ...input.metadata, redacted: true },
        }),
      ],
    } satisfies Partial<ConversationEnvironment>;
    let conversation = createConversation({ id: 'conversation-environment' });

    conversation = appendUserMessage(conversation, 'Sensitive', environment);
    conversation = appendAssistantMessage(
      conversation,
      'Acknowledged',
      { visible: true },
      environment,
    );

    const [firstMessageId, secondMessageId] = conversation.ids;
    const firstMessage = conversation.messages[firstMessageId!]!;
    const secondMessage = conversation.messages[secondMessageId!]!;

    expect(firstMessage.id).toBe('fixed-1');
    expect(firstMessage.createdAt).toBe('2026-07-09T00:00:00.000Z');
    expect(firstMessage.metadata).toEqual({ redacted: true });
    expect(secondMessage.id).toBe('fixed-2');
    expect(secondMessage.metadata).toEqual({ visible: true, redacted: true });
  });

  test('appendMessages preserves explicitly empty plugin environments', () => {
    const conversation = appendMessages(
      createConversation({ id: 'conversation-empty-plugins-environment' }),
      { role: 'assistant', content: 'Hello' },
      { plugins: [] },
    );
    const message = conversation.messages[conversation.ids[0]!]!;

    expect(message.content).toBe('Hello');
  });

  test('role-specific append helpers keep plugin-shaped metadata in the three-argument overload', () => {
    const metadata = {
      plugins: ['ui'],
    };

    const conversation = appendUserMessage(
      createConversation({ id: 'conversation-plugin-metadata' }),
      'Hello',
      metadata,
    );
    const message = conversation.messages[conversation.ids[0]!]!;

    expect(message.metadata).toEqual(metadata);
  });

  test('role-specific append helpers keep empty plugin-list metadata', () => {
    const metadata = {
      plugins: [],
    };

    const userConversation = appendUserMessage(
      createConversation({ id: 'conversation-empty-plugin-user-metadata' }),
      'Hello',
      metadata,
    );
    const assistantConversation = appendAssistantMessage(
      createConversation({ id: 'conversation-empty-plugin-assistant-metadata' }),
      'Hello',
      metadata,
    );

    expect(userConversation.messages[userConversation.ids[0]!]!.metadata).toEqual(metadata);
    expect(assistantConversation.messages[assistantConversation.ids[0]!]!.metadata).toEqual(
      metadata,
    );
  });

  test('role-specific append helpers keep persistence metadata in the three-argument overload', () => {
    const metadata = {
      persistence: { mode: 'local' },
    };

    const conversation = appendUserMessage(
      createConversation({ id: 'conversation-persistence-metadata' }),
      'Hello',
      metadata,
    );
    const message = conversation.messages[conversation.ids[0]!]!;

    expect(message.metadata).toEqual(metadata);
  });

  test('role-specific append helpers keep environment-shaped metadata when a fourth argument is supplied', () => {
    const environmentShapedMetadata = {
      plugins: ['ui'],
      persistence: { mode: 'local' },
    };
    const environment = {
      now: () => '2026-07-09T00:00:00.000Z',
      randomId: () => 'fixed-message',
    } satisfies Partial<ConversationEnvironment>;

    const conversation = appendUserMessage(
      createConversation({ id: 'conversation-metadata-environment' }),
      'Hello',
      environmentShapedMetadata,
      environment,
    );
    const message = conversation.messages[conversation.ids[0]!]!;

    expect(message.id).toBe('fixed-message');
    expect(message.createdAt).toBe('2026-07-09T00:00:00.000Z');
    expect(message.metadata).toEqual(environmentShapedMetadata);
  });

  test('role-specific append helpers reject malformed metadata', () => {
    const conversation = createConversation({ id: 'conversation-invalid-helper-metadata' });

    expect(() =>
      appendUserMessage(conversation, 'Hello', ['not', 'metadata'] as unknown as Record<
        string,
        JSONValue
      >),
    ).toThrow('metadata must be a JSON-compatible object');

    expect(() =>
      appendAssistantMessage(
        conversation,
        'Hello',
        new Date() as unknown as Record<string, JSONValue>,
      ),
    ).toThrow('metadata must be a JSON-compatible object');
  });

  test('appendMessages only preserves goal completion on assistant messages', () => {
    const conversation = appendMessages(
      createConversation({ id: 'conversation-goal-completion' }),
      {
        role: 'user',
        content: 'Can you do this?',
        goalCompleted: true,
      } as unknown as MessageInput,
      {
        role: 'assistant',
        content: 'Done.',
        goalCompleted: true,
      },
    );
    const [userMessageId, assistantMessageId] = conversation.ids;
    const userMessage = conversation.messages[userMessageId!]!;
    const assistantMessage = conversation.messages[assistantMessageId!]!;

    expect('goalCompleted' in userMessage).toBe(false);
    expect(assistantMessage).toMatchObject({ role: 'assistant', goalCompleted: true });

    expect(() =>
      appendMessages(createConversation({ id: 'conversation-invalid-goal-completion' }), {
        role: 'assistant',
        content: 'Done.',
        goalCompleted: 'false',
      } as unknown as MessageInput),
    ).toThrow('appendMessages expected MessageInput arguments before the optional environment');
  });

  test('appendMessages rejects environment plugin entries that are not functions', () => {
    const conversation = createConversation({ id: 'conversation-invalid-plugin' });
    const environment = {
      now: () => '2026-07-09T00:00:00.000Z',
      plugins: ['ui'],
    } as unknown as Partial<ConversationEnvironment>;

    expect(() =>
      appendMessages(conversation, { role: 'user', content: 'Hello' }, environment),
    ).toThrow('conversation environment plugins must be functions');
  });
});
