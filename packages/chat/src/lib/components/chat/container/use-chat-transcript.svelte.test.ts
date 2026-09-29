import { describe, expect, test } from 'bun:test';
import { tick } from 'svelte';
import { appendStreamingMessage, updateStreamingMessage } from '../builders.ts';
import type { ConversationHistory, Message } from '../conversation-model.ts';
import { createTranscriptFixture } from './use-chat-transcript-test-fixture.svelte.ts';

function message(
  id: string,
  role: Message['role'] = 'assistant',
  metadata: Message['metadata'] = {},
): Message {
  return {
    id,
    role,
    content: id,
    position: 0,
    createdAt: '2026-06-01T12:00:00.000Z',
    metadata,
    hidden: false,
  };
}

function toolCallMessage(id: string): Message {
  return {
    ...message(id, 'tool-call'),
    toolCall: { id, name: 'check', arguments: {} },
  };
}

function conversation(messages: Message[]): ConversationHistory {
  return {
    schemaVersion: 1,
    id: 'conversation',
    status: 'active',
    metadata: {},
    ids: messages.map((item) => item.id),
    messages: Object.fromEntries(messages.map((item) => [item.id, item])),
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
  };
}

describe('useChatTranscript live inputs', () => {
  test('reacts to conversation, unread, typing, grouping, and reasoning changes', async () => {
    const fixture = createTranscriptFixture(
      conversation([{ ...message('first', 'assistant', { streaming: true }), content: '' }]),
    );
    const { transcript } = fixture;

    expect(transcript.messages.map((item) => item.id)).toEqual(['first']);
    fixture.setStreaming(true);
    fixture.setFirstUnreadId('first');
    await tick();

    expect(transcript.reasoningStreaming).toBe(false);
    expect(transcript.renderRows.map((item) => item.type)).toContain('unread-divider');
    expect(transcript.showTypingIndicator).toBe(true);

    fixture.setStreamingMessageId('');
    await tick();
    expect(transcript.showTypingIndicator).toBe(true);

    fixture.setReasoning((item) => (item.id === 'first' ? 'thinking' : undefined));
    fixture.setStreamingMessageId('first');
    await tick();
    expect(transcript.reasoningStreaming).toBe(true);
    expect(transcript.showTypingIndicator).toBe(false);

    fixture.setConversation(
      conversation([message('first', 'assistant', { streaming: true }), toolCallMessage('call')]),
    );
    await tick();
    expect(
      transcript.renderRows.some(
        (item) => item.type === 'tool-call-group' && item.messages.some(({ id }) => id === 'call'),
      ),
    ).toBe(true);
    fixture.setUngroupAllToolCalls(true);
    await tick();
    expect(
      transcript.renderRows.some((item) => item.type === 'message' && item.message.id === 'call'),
    ).toBe(true);
    fixture.setUngroupAllToolCalls(false);
    await tick();
    expect(
      transcript.renderRows.some(
        (item) => item.type === 'tool-call-group' && item.messages.some(({ id }) => id === 'call'),
      ),
    ).toBe(true);

    fixture.setReasoning(undefined);
    fixture.setConversation(
      conversation([{ ...message('first', 'assistant', { streaming: true }), content: '' }]),
    );
    fixture.setStreamingMessageId(null);
    await tick();
    expect(transcript.reasoningStreaming).toBe(false);
    expect(transcript.showTypingIndicator).toBe(true);

    fixture.setStreamingMessageId('first');
    fixture.setStreamingContent('first token');
    fixture.setConversation(conversation([message('first'), message('second')]));
    fixture.setUngroupAllToolCalls(true);
    await tick();

    expect(transcript.messages).toHaveLength(2);
    expect(transcript.showTypingIndicator).toBe(false);
  });

  test('keeps the separate typing row when streaming starts before an assistant row exists', async () => {
    const fixture = createTranscriptFixture(conversation([message('user-first', 'user')]));
    const { transcript } = fixture;

    fixture.setStreaming(true);
    await tick();

    expect(transcript.showTypingIndicator).toBe(true);
    expect(transcript.renderRows.map((item) => item.type)).toContain('typing');
  });

  test('keeps the separate typing row after beginStreaming reserves a row before content arrives', async () => {
    const fixture = createTranscriptFixture(
      conversation([{ ...message('first', 'assistant', { streaming: true }), content: '' }]),
    );
    const { transcript } = fixture;

    fixture.setStreaming(true);
    fixture.setStreamingMessageId('first');
    await tick();

    expect(transcript.showTypingIndicator).toBe(true);
    expect(transcript.renderRows.map((item) => item.type)).toContain('typing');

    fixture.setStreamingContent('first token');
    await tick();

    expect(transcript.showTypingIndicator).toBe(false);
    expect(transcript.renderRows.map((item) => item.type)).not.toContain('typing');
  });

  test('recognizes the canonical Conversationalist streaming marker for content-driven streams', async () => {
    const started = appendStreamingMessage(conversation([]), 'assistant', undefined, {
      now: () => '2026-06-01T12:00:00.000Z',
      randomId: () => 'streaming-assistant',
    });
    const fixture = createTranscriptFixture(started.conversation);
    const { transcript } = fixture;

    fixture.setStreaming(true);
    await tick();

    expect(transcript.showTypingIndicator).toBe(true);

    fixture.setConversation(
      updateStreamingMessage(started.conversation, started.messageId, 'first token', {
        now: () => '2026-06-01T12:00:01.000Z',
        randomId: () => 'unused',
      }),
    );
    await tick();

    expect(transcript.showTypingIndicator).toBe(false);
    expect(transcript.renderRows.map((item) => item.type)).not.toContain('typing');
  });
});
