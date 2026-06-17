/**
 * C3 unit tests for `deriveMessageParts` — the tool-approval branch.
 *
 * Verifies that:
 *   1. A tool-result message with outcome === 'action_required' + action emits a
 *      `tool-approval` part instead of the plain `tool-result` part.
 *   2. The approval part carries the correct key, toolCallId, action, and derived
 *      `approved` state from the context's approved/denied id sets.
 *   3. A tool-result with outcome === 'success' or 'error' still emits a plain
 *      `tool-result` part (the existing path is unchanged).
 *   4. A tool-result with outcome === 'action_required' but WITHOUT an action still
 *      emits the plain `tool-result` part (guard on `action` presence).
 *   5. The approved state is `undefined` when the call id is in neither set.
 *   6. The approved state is `true` when the call id is in the approvedToolCallIds set.
 *   7. The approved state is `false` when the call id is in the deniedToolCallIds set.
 *   8. A plain conversationalist transcript with normal tool results sees zero change.
 */

import { describe, expect, it } from 'bun:test';

import type { Message } from '../conversation-model.ts';
import { deriveMessageParts } from './utilities.ts';

function message(overrides: Partial<Message> & Pick<Message, 'role'>): Message {
  return {
    id: 'tr1',
    content: '',
    position: 0,
    createdAt: '2026-06-02T00:00:00.000Z',
    metadata: {},
    hidden: false,
    ...overrides,
  };
}

describe('C3 — tool-approval derivation (action_required with action)', () => {
  it('emits a tool-approval part (not tool-result) for action_required + action', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'action_required',
        content: null,
        action: { type: 'approval', message: 'Deploy to prod?' },
      },
    });
    const parts = deriveMessageParts(msg);
    expect(parts).toHaveLength(1);
    expect(parts[0]?.type).toBe('tool-approval');
  });

  it('carries the correct key pattern', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'action_required',
        content: null,
        action: { type: 'approval', message: 'Deploy?' },
      },
    });
    const parts = deriveMessageParts(msg);
    expect(parts[0]?.key).toBe('tr:tool-approval:call-1');
  });

  it('carries the toolCallId from the result.callId', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-99',
        outcome: 'action_required',
        content: null,
        action: { type: 'approval', message: 'Confirm?' },
      },
    });
    const parts = deriveMessageParts(msg);
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.toolCallId).toBe('call-99');
  });

  it('carries the action object from the tool result', () => {
    const action = { type: 'approval' as const, message: 'Approve this?' };
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'action_required',
        content: null,
        action,
      },
    });
    const parts = deriveMessageParts(msg);
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.action).toEqual(action);
  });

  it('approved is undefined when call id is in neither set', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'action_required',
        content: null,
        action: { type: 'approval', message: 'Proceed?' },
      },
    });
    const parts = deriveMessageParts(msg, {
      approvedToolCallIds: new Set(['call-99']),
      deniedToolCallIds: new Set(['call-88']),
    });
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.approved).toBeUndefined();
  });

  it('approved is true when call id is in approvedToolCallIds', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'action_required',
        content: null,
        action: { type: 'approval', message: 'Proceed?' },
      },
    });
    const parts = deriveMessageParts(msg, {
      approvedToolCallIds: new Set(['call-1']),
    });
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.approved).toBe(true);
  });

  it('approved is false when call id is in deniedToolCallIds', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'action_required',
        content: null,
        action: { type: 'approval', message: 'Proceed?' },
      },
    });
    const parts = deriveMessageParts(msg, {
      deniedToolCallIds: new Set(['call-1']),
    });
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.approved).toBe(false);
  });

  it('approved prefers approvedToolCallIds over deniedToolCallIds when call id is in both (approved wins)', () => {
    // Defense-in-depth: if a call id ends up in both sets (should not happen
    // under normal operation), the approved check runs first so the UI shows
    // approved rather than denied.
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'action_required',
        content: null,
        action: { type: 'approval', message: 'Proceed?' },
      },
    });
    const parts = deriveMessageParts(msg, {
      approvedToolCallIds: new Set(['call-1']),
      deniedToolCallIds: new Set(['call-1']),
    });
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.approved).toBe(true);
  });
});

describe('C3 — toolName resolution', () => {
  it('uses callId as toolName when no toolCallPair is in context', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-deploy-prod',
        outcome: 'action_required',
        content: null,
        action: { type: 'approval', message: 'Deploy to prod?' },
      },
    });
    const parts = deriveMessageParts(msg);
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.toolName).toBe('call-deploy-prod');
  });

  it('uses call.name from toolCallPair when present in context', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-deploy-prod',
        outcome: 'action_required',
        content: null,
        action: { type: 'approval', message: 'Deploy to prod?' },
      },
    });
    const parts = deriveMessageParts(msg, {
      toolCallPair: {
        call: { id: 'call-deploy-prod', name: 'deploy_to_production', arguments: {} },
        result: undefined,
      },
    });
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.toolName).toBe('deploy_to_production');
  });

  it('uses callId as toolName when context has no toolCallPair at all', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-abc',
        outcome: 'action_required',
        content: null,
        action: { type: 'approval', message: 'Continue?' },
      },
    });
    // No toolCallPair in context at all
    const parts = deriveMessageParts(msg, {});
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.toolName).toBe('call-abc');
  });
});

describe('C3 — plain tool-result path is unchanged', () => {
  it('outcome=success still emits a tool-result part', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: { callId: 'call-1', outcome: 'success', content: { ok: true } },
    });
    const parts = deriveMessageParts(msg);
    expect(parts[0]?.type).toBe('tool-result');
  });

  it('outcome=error still emits a tool-result part', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'error',
        content: null,
        error: { code: 'E', category: 'internal', retryable: false, message: 'boom' },
      },
    });
    const parts = deriveMessageParts(msg);
    expect(parts[0]?.type).toBe('tool-result');
  });

  it('outcome=action_required WITHOUT action still emits a tool-result part', () => {
    // The contract: only intercept when BOTH outcome === 'action_required' AND
    // action is present. A malformed message with no action falls through to the
    // normal tool-result path.
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'action_required',
        content: null,
        // no `action` field
      },
    });
    const parts = deriveMessageParts(msg);
    expect(parts[0]?.type).toBe('tool-result');
  });
});

describe('C3 — compatibility: plain transcripts render unchanged', () => {
  it('a normal success tool-result renders as tool-result, not tool-approval', () => {
    const msg = message({
      role: 'tool-result',
      toolResult: { callId: 'c', outcome: 'success', content: 'done' },
    });
    const parts = deriveMessageParts(msg);
    expect(parts.length).toBe(1);
    expect(parts[0]?.type).not.toBe('tool-approval');
  });

  it('a markdown message with no toolResult is unaffected', () => {
    const msg = message({ role: 'assistant', content: 'Hello' });
    const parts = deriveMessageParts(msg);
    expect(parts[0]?.type).toBe('markdown');
  });

  it('context with no approval sets does not affect existing parts', () => {
    const msg = message({
      role: 'tool-result',
      toolResult: { callId: 'c', outcome: 'success', content: 'done' },
    });
    const parts = deriveMessageParts(msg, {
      approvedToolCallIds: undefined,
      deniedToolCallIds: undefined,
    });
    expect(parts[0]?.type).toBe('tool-result');
  });
});
