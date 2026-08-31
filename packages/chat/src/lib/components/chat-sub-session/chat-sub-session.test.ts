import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { appendAssistantMessage, appendUserMessage, createConversation } from '../chat/builders.ts';
import type { Message, ToolCall } from '../chat/conversation-model.ts';
import { getMessages, pairToolCallsWithResults } from '../chat/utilities/index.ts';

describe('chat sub-session data contract', () => {
  test('uses the existing ConversationHistory snapshot without metadata mutation', () => {
    const conversation = appendAssistantMessage(
      appendUserMessage(createConversation({ id: 'child' }), 'Investigate this branch'),
      'The child session is still running.',
    );
    expect(getMessages(conversation)).toHaveLength(2);
    expect(conversation.id).toBe('child');
  });

  test('keeps the nested transcript reduced, bounded, and live-only animated', async () => {
    const source = await readFile(new URL('./chat-sub-session.svelte', import.meta.url), 'utf8');
    const stylesheet = await readFile(new URL('./chat-sub-session.css', import.meta.url), 'utf8');
    expect(stylesheet).toContain('--cinder-chat-font-size: 0.8125rem');
    expect(stylesheet).toContain('--_cinder-chat-text-3xs:');
    expect(stylesheet).toContain('--_cinder-chat-text-xs:');
    expect(stylesheet).toContain('--_cinder-chat-text-sm:');
    expect(stylesheet).toContain('--_cinder-chat-text-base:');
    expect(stylesheet).toContain('--_cinder-chat-text-lg:');
    expect(stylesheet).toContain('max-block-size: 7.75rem');
    expect(stylesheet).not.toContain('mask-image');
    expect(stylesheet).not.toContain('.chat-sub-session::after');
    expect(source).toContain('class:chat-sub-session-live={live}');
    expect(stylesheet).toContain('.chat-sub-session-live .chat-message');
    expect(stylesheet).toContain('prefers-reduced-motion');
    expect(source).toContain('role="log"');
    expect(source).toContain('class="chat-sub-session-viewport"');
    expect(source).toContain('the labelled transcript log must be keyboard-scrollable');
    expect(source).toContain('tabindex="0"');
    expect(source).not.toContain('tabindex={0}');
    expect(source).toContain('idPrefix={`${instanceId}-${message.id}`}');
  });

  test('pairs tool calls with their results in the default nested transcript', async () => {
    const source = await readFile(new URL('./chat-sub-session.svelte', import.meta.url), 'utf8');
    expect(source).toContain('pairToolCallsWithResults(messages)');
    expect(source).toContain('new Map(toolCallPairs.map((pair) => [pair.call, pair] as const))');
    expect(source).toContain('toolCallPairsByCall.get(message.toolCall)');
    expect(source).toContain('toolCallPairs={toolCallPair ? [toolCallPair] : []}');
    expect(source).toContain('pairedToolResults.has(message.toolResult)');
  });

  test('keeps repeated tool-call IDs attached to their call occurrence', () => {
    const firstCall: ToolCall = { id: 'repeated', name: 'first', arguments: {} };
    const secondCall: ToolCall = { id: 'repeated', name: 'second', arguments: {} };
    const messageDefaults = {
      content: '',
      position: 0,
      createdAt: '2026-08-31T00:00:00.000Z',
      metadata: {},
      hidden: false,
    } as const;
    const messages: Message[] = [
      { ...messageDefaults, id: 'call-1', role: 'tool-call', toolCall: firstCall },
      {
        ...messageDefaults,
        id: 'result-1',
        role: 'tool-result',
        toolResult: { callId: 'repeated', outcome: 'success', content: 'first result' },
      },
      { ...messageDefaults, id: 'call-2', role: 'tool-call', toolCall: secondCall },
      {
        ...messageDefaults,
        id: 'result-2',
        role: 'tool-result',
        toolResult: { callId: 'repeated', outcome: 'success', content: 'second result' },
      },
    ];
    const pairs = pairToolCallsWithResults(messages);
    const pairsByCall = new Map(pairs.map((pair) => [pair.call, pair] as const));

    expect(pairsByCall.get(firstCall)?.call).toBe(firstCall);
    expect(pairsByCall.get(secondCall)?.call).toBe(secondCall);
    expect(pairsByCall.get(firstCall)?.result?.content).toBe('first result');
    expect(pairsByCall.get(secondCall)?.result?.content).toBe('second result');
  });
});
