import { describe, expect, test } from 'bun:test';

import {
  appendAssistantMessage,
  appendMessages,
  appendToolCall,
  appendToolCalls,
  appendToolResult,
  appendToolResultAsync,
  appendToolResults,
  appendToolResultsAsync,
  appendUserMessage,
  buildMessage,
  clearMessageDeliveryStatus,
  createConversation,
  createConversationHistory,
  markMessageDeliveryFailed,
  prependMessages,
} from './builders.ts';

describe('chat conversation builders', () => {
  test('uses Conversationalist 0.5 createConversationHistory snapshots', () => {
    const conversation = createConversationHistory({ id: 'conversation-builders' });

    expect(conversation).toMatchObject({
      schemaVersion: 5,
      id: 'conversation-builders',
      metadata: {},
      ids: [],
      messages: {},
    });
  });

  test('keeps createConversation as a migration alias', () => {
    const conversation = createConversation({ id: 'conversation-alias' });

    expect(conversation.schemaVersion).toBe(5);
    expect(conversation.id).toBe('conversation-alias');
  });

  test('re-exports the 0.5 buildMessage and prependMessages helpers', () => {
    const initial = createConversationHistory({ id: 'conversation-prepend' });
    const existing = appendAssistantMessage(initial, 'Existing');
    const prepared = buildMessage({ role: 'user', content: 'First' }, { position: 0 });
    const next = prependMessages(existing, prepared);

    expect(next.ids).toHaveLength(2);
    expect(next.messages[next.ids[0]!]!.content).toBe('First');
    expect(next.messages[next.ids[1]!]!.content).toBe('Existing');
    expect(next.messages[next.ids[0]!]!.position).toBe(0);
    expect(next.messages[next.ids[1]!]!.position).toBe(1);
  });

  test('keeps Chat role helpers aligned with the canonical builder', () => {
    const conversation = appendUserMessage(
      createConversationHistory({ id: 'conversation-role-helper' }),
      'Hello',
    );

    expect(conversation.messages[conversation.ids[0]!]!.role).toBe('user');
    expect(conversation.messages[conversation.ids[0]!]!.content).toBe('Hello');
  });

  test('marks and clears transient delivery status immutably', () => {
    const initial = appendUserMessage(
      createConversationHistory({ id: 'conversation-delivery-status' }),
      'Send this',
    );
    const messageId = initial.ids[0]!;
    const failed = markMessageDeliveryFailed(initial, messageId);
    const cleared = clearMessageDeliveryStatus(failed, messageId);

    expect(initial.messages[messageId]!.metadata).toEqual({});
    expect(failed.messages[messageId]!.metadata).toEqual({ _deliveryStatus: 'failed' });
    expect(cleared.messages[messageId]!.metadata).toEqual({});
    expect(failed).not.toBe(initial);
    expect(cleared).not.toBe(failed);
  });

  test('returns the same history when delivery is already marked failed', () => {
    const initial = appendUserMessage(
      createConversationHistory({ id: 'conversation-idempotent-delivery-status' }),
      'Send this',
    );
    const messageId = initial.ids[0]!;
    const failed = markMessageDeliveryFailed(initial, messageId);

    expect(markMessageDeliveryFailed(failed, messageId)).toBe(failed);
  });

  test('handles transcripts that omit metadata at runtime', () => {
    const initial = appendUserMessage(
      createConversationHistory({ id: 'conversation-missing-metadata' }),
      'Send this',
    );
    const messageId = initial.ids[0]!;
    const messageWithoutMetadata = { ...initial.messages[messageId]! } as {
      metadata?: unknown;
    } & (typeof initial.messages)[string];
    delete (messageWithoutMetadata as unknown as { metadata?: unknown }).metadata;
    const historyWithoutMetadata = {
      ...initial,
      messages: { ...initial.messages, [messageId]: messageWithoutMetadata },
    };

    const failed = markMessageDeliveryFailed(historyWithoutMetadata, messageId);
    const cleared = clearMessageDeliveryStatus(historyWithoutMetadata, messageId);

    expect(failed.messages[messageId]!.metadata).toEqual({ _deliveryStatus: 'failed' });
    expect(cleared).toBe(historyWithoutMetadata);
  });

  test('leaves history unchanged when the message id is unknown', () => {
    const initial = createConversationHistory({ id: 'conversation-missing-delivery-status' });

    expect(markMessageDeliveryFailed(initial, 'missing')).toBe(initial);
    expect(clearMessageDeliveryStatus(initial, 'missing')).toBe(initial);
  });

  test('preserves immutable snapshots and dense message positions', () => {
    const initial = createConversationHistory({ id: 'conversation-immutability' });
    const unchanged = appendMessages(initial);
    expect(unchanged.id).toBe(initial.id);
    expect(unchanged.ids).toEqual(initial.ids);
    expect(unchanged.messages).toEqual(initial.messages);
    expect(unchanged.metadata).toEqual(initial.metadata);

    const next = appendMessages(initial, { role: 'user', content: 'First' });
    const final = appendMessages(next, { role: 'assistant', content: 'Second' });

    expect(initial.ids).toEqual([]);
    expect(next.ids).toHaveLength(1);
    expect(final.ids).toHaveLength(2);
    expect(final.messages[final.ids[0]!]!.position).toBe(0);
    expect(final.messages[final.ids[1]!]!.position).toBe(1);
  });

  test('re-exports all tool transcript builder variants', async () => {
    const initial = createConversationHistory({ id: 'conversation-tools' });
    const withCalls = appendToolCalls(
      appendToolCall(initial, {
        id: 'call-one',
        name: 'lookup',
        arguments: { query: 'first' },
      }),
      [
        { id: 'call-two', name: 'lookup', arguments: { query: 'second' } },
        { id: 'call-three', name: 'lookup', arguments: { query: 'third' } },
      ],
    );
    const withResults = appendToolResults(
      appendToolResult(withCalls, {
        callId: 'call-one',
        outcome: 'success',
        content: { value: 1 },
      }),
      [
        { callId: 'call-two', outcome: 'success', content: { value: 2 } },
        { callId: 'call-three', outcome: 'success', content: { value: 3 } },
      ],
    );
    const withAsyncCall = appendToolCall(withResults, {
      id: 'call-four',
      name: 'lookup',
      arguments: { query: 'fourth' },
    });
    const withAsyncResult = await appendToolResultAsync(withAsyncCall, {
      callId: 'call-four',
      outcome: 'success',
      content: { value: 4 },
    });
    const withAsyncCalls = appendToolCalls(withAsyncResult, [
      { id: 'call-five', name: 'lookup', arguments: { query: 'fifth' } },
      { id: 'call-six', name: 'lookup', arguments: { query: 'sixth' } },
    ]);
    const final = await appendToolResultsAsync(withAsyncCalls, [
      { callId: 'call-five', outcome: 'success', content: { value: 5 } },
      { callId: 'call-six', outcome: 'success', content: { value: 6 } },
    ]);

    const messages = final.ids.map((id) => final.messages[id]!);
    expect(messages.filter((message) => message.role === 'tool-call')).toHaveLength(6);
    expect(messages.filter((message) => message.role === 'tool-result')).toHaveLength(6);
    expect(messages.map((message) => message.position)).toEqual(
      Array.from({ length: 12 }, (_, index) => index),
    );
  });
});
