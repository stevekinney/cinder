import { describe, expect, test } from 'bun:test';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import { encodeChatStreamEvent } from './stream-event-codec.ts';

describe('encoder validates primitive fields', () => {
  test('rejects a non-string text on the legacy text member', () => {
    const event = hostileEvent({ type: 'text', text: 42 });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: text must be a string',
    );
  });

  const envelope = { wireVersion: 1 as const, sequence: 1 };

  test('rejects a non-string content on stream:text-delta', () => {
    const event = hostileEvent({
      type: 'stream:text-delta',
      content: 42,
      accumulated: 'hello',
      ...envelope,
    });

    expect(() => encodeChatStreamEvent(event)).toThrow(/content must be a string/);
  });

  test('rejects an undefined toolName on stream:tool-call-start', () => {
    const event = hostileEvent({
      type: 'stream:tool-call-start',
      toolName: undefined,
      blockId: 'b1',
      ...envelope,
    });

    expect(() => encodeChatStreamEvent(event)).toThrow(/toolName must be a string/);
  });
});
