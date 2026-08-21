import { describe, expect, it } from 'bun:test';

import type {
  ConversationHistory,
  Message,
  ToolAction,
  ToolResult,
} from '../conversation-model.ts';
import {
  findToolResultMessage,
  getMessages,
  getUnresolvedToolApprovals,
  pairToolCallsWithResults,
} from './conversation.ts';

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

describe('getUnresolvedToolApprovals', () => {
  it('finds a tool-result message parked on action_required with an action', () => {
    const pending: ToolResult & { action: ToolAction } = {
      callId: 'call-1',
      outcome: 'action_required',
      content: null,
      action: { type: 'approval', message: 'Allow this?' },
    };
    const result = message({ id: 'r1', role: 'tool-result', toolResult: pending });
    const conversation = history([result]);

    const approvals = getUnresolvedToolApprovals(conversation);
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.message.id).toBe('r1');
    expect(approvals[0]?.result).toBe(pending);
  });

  it('excludes resolved (success/error) and action-less results', () => {
    const success: ToolResult = { callId: 'call-1', outcome: 'success', content: null };
    const errored: ToolResult = { callId: 'call-2', outcome: 'error', content: null };
    const noAction: ToolResult = { callId: 'call-3', outcome: 'action_required', content: null };
    const conversation = history([
      message({ id: 'r1', role: 'tool-result', toolResult: success }),
      message({ id: 'r2', role: 'tool-result', toolResult: errored }),
      message({ id: 'r3', role: 'tool-result', toolResult: noAction }),
    ]);

    expect(getUnresolvedToolApprovals(conversation)).toHaveLength(0);
  });

  it('excludes hidden approvals by default and includes them with includeHidden', () => {
    const pending: ToolResult = {
      callId: 'call-1',
      outcome: 'action_required',
      content: null,
      action: { type: 'approval' },
    };
    const conversation = history([
      message({ id: 'r1', role: 'tool-result', toolResult: pending, hidden: true }),
    ]);

    expect(getUnresolvedToolApprovals(conversation)).toHaveLength(0);
    expect(getUnresolvedToolApprovals(conversation, { includeHidden: true })).toHaveLength(1);
  });

  it('ignores non-tool-result messages carrying an incidental toolResult field', () => {
    const conversation = history([
      message({
        id: 'a',
        role: 'assistant',
        toolResult: {
          callId: 'call-1',
          outcome: 'action_required',
          content: null,
          action: { type: 'approval' },
        },
      }),
    ]);

    expect(getUnresolvedToolApprovals(conversation)).toHaveLength(0);
  });
});

describe('findToolResultMessage', () => {
  it('finds the tool-result message whose result carries the given call id', () => {
    const result: ToolResult = { callId: 'call-1', outcome: 'success', content: null };
    const conversation = history([
      message({
        id: 'm1',
        role: 'tool-call',
        toolCall: { id: 'call-1', name: 'fn', arguments: {} },
      }),
      message({ id: 'm2', role: 'tool-result', toolResult: result }),
    ]);

    const found = findToolResultMessage(conversation, 'call-1');
    expect(found?.id).toBe('m2');
  });

  it('returns undefined for an unknown call id (no-op)', () => {
    const conversation = history([
      message({
        id: 'm1',
        role: 'tool-result',
        toolResult: { callId: 'call-1', outcome: 'success', content: null },
      }),
    ]);

    expect(findToolResultMessage(conversation, 'missing')).toBeUndefined();
  });

  it('respects includeHidden like getMessages', () => {
    const result: ToolResult = { callId: 'call-1', outcome: 'success', content: null };
    const conversation = history([
      message({ id: 'm1', role: 'tool-result', toolResult: result, hidden: true }),
    ]);

    expect(findToolResultMessage(conversation, 'call-1')).toBeUndefined();
    expect(findToolResultMessage(conversation, 'call-1', { includeHidden: true })?.id).toBe('m1');
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

  it('ignores non-tool-role messages carrying incidental tool-shaped fields', () => {
    // A user/assistant message with a stray toolCall/toolResult must NOT become
    // a pair — pairing is role-gated, not property-presence-gated.
    const messages = [
      message({ id: 'u', role: 'user', toolCall: { id: 'call-x', name: 'fn', arguments: {} } }),
      message({
        id: 'a',
        role: 'assistant',
        toolResult: { callId: 'call-x', outcome: 'success', content: null },
      }),
    ];
    expect(pairToolCallsWithResults(messages)).toHaveLength(0);
  });

  it('ignores tool roles that do not carry the matching tool field', () => {
    const messages = [
      message({ id: 'missing-call', role: 'tool-call', content: 'orphan call body' }),
      message({ id: 'missing-result', role: 'tool-result', content: 'orphan result body' }),
      message({
        id: 'call',
        role: 'tool-call',
        toolCall: { id: 'call-1', name: 'fn', arguments: {} },
      }),
      message({ id: 'result', role: 'tool-result', toolResult: success }),
    ];

    const pairs = pairToolCallsWithResults(messages);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.call.id).toBe('call-1');
    expect(pairs[0]?.result).toBe(success);
  });
});
