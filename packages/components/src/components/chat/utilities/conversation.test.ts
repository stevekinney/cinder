import { describe, expect, it } from 'bun:test';

import type { ConversationHistory, Message, ToolResult } from '../conversation-model.ts';
import { getMessages, pairToolCallsWithResults } from './conversation.ts';

function message(overrides: Partial<Message> & Pick<Message, 'id'>): Message {
  return {
    role: 'user',
    content: '',
    position: 0,
    createdAt: '2026-06-02T00:00:00.000Z',
    metadata: {},
    hidden: false,
    ...overrides,
  };
}

function history(messages: Message[], ids?: string[]): ConversationHistory {
  return {
    schemaVersion: 4,
    id: 'conversation-1',
    status: 'active',
    metadata: {},
    ids: ids ?? messages.map((m) => m.id),
    messages: Object.fromEntries(messages.map((m) => [m.id, m])),
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
  };
}

describe('getMessages', () => {
  it('returns messages in the order given by ids, not record insertion order', () => {
    const a = message({ id: 'a' });
    const b = message({ id: 'b' });
    const conversation = history([a, b], ['b', 'a']);
    expect(getMessages(conversation).map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('skips ids with no matching record (no throw)', () => {
    const a = message({ id: 'a' });
    const conversation = history([a], ['a', 'ghost']);
    expect(getMessages(conversation).map((m) => m.id)).toEqual(['a']);
  });

  it('excludes records not referenced by ids', () => {
    const a = message({ id: 'a' });
    const orphan = message({ id: 'orphan' });
    const conversation = history([a, orphan], ['a']);
    expect(getMessages(conversation).map((m) => m.id)).toEqual(['a']);
  });

  it('filters hidden messages by default and includes them with includeHidden', () => {
    const visible = message({ id: 'visible' });
    const secret = message({ id: 'secret', hidden: true });
    const conversation = history([visible, secret]);
    expect(getMessages(conversation).map((m) => m.id)).toEqual(['visible']);
    expect(getMessages(conversation, { includeHidden: true }).map((m) => m.id)).toEqual([
      'visible',
      'secret',
    ]);
  });
});

describe('pairToolCallsWithResults', () => {
  const success: ToolResult = { callId: 'call-1', outcome: 'success', content: { ok: true } };

  it('pairs a tool call with its matching result', () => {
    const messages = [
      message({
        id: 'm1',
        role: 'tool-call',
        toolCall: { id: 'call-1', name: 'fn', arguments: {} },
      }),
      message({ id: 'm2', role: 'tool-result', toolResult: success }),
    ];
    const pairs = pairToolCallsWithResults(messages);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.call.id).toBe('call-1');
    expect(pairs[0]?.result).toBe(success);
  });

  it('leaves result undefined when a call has no matching result', () => {
    const messages = [
      message({
        id: 'm1',
        role: 'tool-call',
        toolCall: { id: 'call-1', name: 'fn', arguments: {} },
      }),
    ];
    const pairs = pairToolCallsWithResults(messages);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.result).toBeUndefined();
  });

  it('uses the last result when two share a callId', () => {
    const earlier: ToolResult = { callId: 'call-1', outcome: 'error', content: null };
    const messages = [
      message({
        id: 'm1',
        role: 'tool-call',
        toolCall: { id: 'call-1', name: 'fn', arguments: {} },
      }),
      message({ id: 'm2', role: 'tool-result', toolResult: earlier }),
      message({ id: 'm3', role: 'tool-result', toolResult: success }),
    ];
    expect(pairToolCallsWithResults(messages)[0]?.result).toBe(success);
  });

  it('never pairs a message absent from the ordered array', () => {
    // A stale tool-result that getMessages would have excluded never reaches
    // pairing, because callers pass the already-ordered getMessages() output.
    const orphanResult: ToolResult = { callId: 'call-1', outcome: 'success', content: null };
    const orphan = message({ id: 'orphan', role: 'tool-result', toolResult: orphanResult });
    const conversation = history(
      [
        message({
          id: 'm1',
          role: 'tool-call',
          toolCall: { id: 'call-1', name: 'fn', arguments: {} },
        }),
        orphan,
      ],
      ['m1'], // orphan not in ids
    );
    const pairs = pairToolCallsWithResults(getMessages(conversation));
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.result).toBeUndefined();
  });
});
