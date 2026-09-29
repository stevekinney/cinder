import { describe, expect, test } from 'bun:test';
import { decodeChatStreamEvent, encodeChatStreamEvent } from './stream-event-codec.ts';

describe('legacy members keep their exact current shape (CIN-507)', () => {
  test('a bare `text` frame with no envelope decodes byte-identically to today', () => {
    const event = { type: 'text' as const, text: 'hello' };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('a bare `tool_call` frame with no envelope decodes byte-identically to today', () => {
    const event = {
      type: 'tool_call' as const,
      id: 'call-1',
      name: 'lookup',
      arguments: { query: 'weather' },
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('a bare `tool_result` frame with no envelope decodes byte-identically to today', () => {
    const event = {
      type: 'tool_result' as const,
      callId: 'call-1',
      outcome: 'success' as const,
      content: { ok: true },
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('legacy members also accept an attached wire envelope', () => {
    const event = { type: 'text' as const, text: 'hi', wireVersion: 1 as const, sequence: 0 };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });
});
