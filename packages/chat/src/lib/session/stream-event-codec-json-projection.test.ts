import { describe, expect, test } from 'bun:test';
import { createConversationHistory } from 'conversationalist';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import { encodeChatStreamEvent } from './stream-event-codec.ts';

const hooked = (): Record<string, unknown> => {
  const value: Record<string, unknown> = { safe: true };
  Object.defineProperty(value, 'toJSON', {
    value: () => ({ leaked: 'sk-should-never-cross-the-wire' }),
    enumerable: false,
  });
  return value;
};

describe('every JSON-valued payload is projected before serialization', () => {
  const envelope = { wireVersion: 1, sequence: 1 } as const;

  test.each([
    ['tool_call.arguments', { type: 'tool_call', id: 't1', name: 'lookup', arguments: hooked() }],
    [
      'tool result content',
      { type: 'tool_result', callId: 't1', outcome: 'success', content: hooked() },
    ],
    [
      'stream:tool-call-complete.arguments',
      { type: 'stream:tool-call-complete', toolName: 'lookup', blockId: 'b1', arguments: hooked() },
    ],
    ['stream:error.error', { type: 'stream:error', error: hooked() }],
    [
      'tool.error.error',
      { type: 'tool.error', toolCallId: 't1', toolName: 'lookup', error: hooked() },
    ],
  ] as const)('refuses a toJSON hook reachable through %s', (context, event) => {
    expect(() => encodeChatStreamEvent(hostileEvent({ ...event, ...envelope }))).toThrow(
      `Invalid chat stream event: ${context} carries a toJSON serialization hook`,
    );
  });

  test('refuses a toJSON hook nested in a pending approval', () => {
    expect(() =>
      encodeChatStreamEvent(
        hostileEvent({
          type: 'tool_result',
          callId: 't1',
          outcome: 'success',
          content: 'ok',
          pendingApproval: { arguments: hooked() },
          ...envelope,
        }),
      ),
    ).toThrow(
      'Invalid chat stream event: tool result pendingApproval.arguments carries a toJSON serialization hook',
    );
  });

  test('copies arrays by index without calling the producer array methods', () => {
    const hostile = ['safe'];
    Object.defineProperty(hostile, 'map', {
      value: () => {
        const leaked: unknown[] = ['safe'];
        Object.defineProperty(leaked, 'toJSON', {
          value: () => ['sk-should-never-cross-the-wire'],
          enumerable: false,
        });
        return leaked;
      },
      enumerable: false,
    });
    const line = encodeChatStreamEvent(
      hostileEvent({
        type: 'tool_call',
        id: 't1',
        name: 'lookup',
        arguments: { items: hostile },
        ...envelope,
      }),
    );
    expect(line).not.toContain('sk-should-never-cross-the-wire');
    const parsedLine: { arguments: { items: unknown[] } } = JSON.parse(line);
    expect(parsedLine.arguments.items).toEqual(['safe']);
  });

  test('keeps an own __proto__ key as data rather than a prototype assignment', () => {
    const conversation = { ...createConversationHistory({ id: 'c1' }) };
    const metadata: Record<string, unknown> = {};
    Object.defineProperty(metadata, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      writable: true,
      configurable: true,
    });
    (conversation as { metadata: unknown }).metadata = metadata;
    const line = encodeChatStreamEvent(
      hostileEvent({
        type: 'run.completed',
        conversation,
        content: 'done',
        usage: { prompt: 1, completion: 1, total: 2 },
        finishReason: 'stop',
        ...envelope,
      }),
    );
    const parsed: { conversation: { metadata: Record<string, unknown> } } = JSON.parse(line);
    expect(Object.hasOwn(parsed.conversation.metadata, '__proto__')).toBe(true);
    expect(parsed.conversation.metadata['__proto__']).toEqual({ polluted: true });
  });
});
