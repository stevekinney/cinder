/**
 * C3 unit tests for `deriveMessageParts` — the tool-approval branch.
 *
 * Verifies that:
 *   1. A tool-result message with outcome === 'action_required' + action emits a
 *      `tool-approval` part instead of the plain `tool-result` part.
 *   2. The approval part carries the correct key, toolCallId, action, and derived
 *      `state` from the context approval map.
 *   3. A tool-result with outcome === 'success' or 'error' still emits a plain
 *      `tool-result` part (the existing path is unchanged).
 *   4. A tool-result with outcome === 'action_required' but WITHOUT an action still
 *      emits the plain `tool-result` part (guard on `action` presence).
 *   5. The approval state is `pending` when the call id is absent from the map.
 *   6. The approval state is `approved` when the call id maps to approved.
 *   7. The approval state is `denied` when the call id maps to denied.
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
        action: {
          type: 'approval',
          message: 'Deploy to prod?',
          risk: 'high' as const,
          operation: {
            kind: 'command' as const,
            command: 'echo approval',
            argsPreview: { ok: true },
          },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
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
        action: {
          type: 'approval',
          message: 'Deploy?',
          risk: 'high' as const,
          operation: {
            kind: 'command' as const,
            command: 'echo approval',
            argsPreview: { ok: true },
          },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
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
        action: {
          type: 'approval',
          message: 'Confirm?',
          risk: 'high' as const,
          operation: {
            kind: 'command' as const,
            command: 'echo approval',
            argsPreview: { ok: true },
          },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
      },
    });
    const parts = deriveMessageParts(msg);
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.toolCallId).toBe('call-99');
  });

  it('carries the action object from the tool result', () => {
    const action = {
      type: 'approval' as const,
      message: 'Approve this?',
      risk: 'high' as const,
      operation: { kind: 'command' as const, command: 'echo approval', argsPreview: { ok: true } },
      policyVersion: 'test-policy',
      idempotencyKey: 'test-approval',
    };
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

  it('state is pending when call id is absent from the approval state map', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'action_required',
        content: null,
        action: {
          type: 'approval',
          message: 'Proceed?',
          risk: 'high' as const,
          operation: {
            kind: 'command' as const,
            command: 'echo approval',
            argsPreview: { ok: true },
          },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
      },
    });
    const parts = deriveMessageParts(msg, {
      approvalStates: new Map([
        ['call-99', 'approved'],
        ['call-88', 'denied'],
      ]),
    });
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.state).toBe('pending');
  });

  it('state is approved when call id maps to approved', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'action_required',
        content: null,
        action: {
          type: 'approval',
          message: 'Proceed?',
          risk: 'high' as const,
          operation: {
            kind: 'command' as const,
            command: 'echo approval',
            argsPreview: { ok: true },
          },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
      },
    });
    const parts = deriveMessageParts(msg, {
      approvalStates: new Map([['call-1', 'approved']]),
    });
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.state).toBe('approved');
  });

  it('state is denied when call id maps to denied', () => {
    const msg = message({
      id: 'tr',
      role: 'tool-result',
      toolResult: {
        callId: 'call-1',
        outcome: 'action_required',
        content: null,
        action: {
          type: 'approval',
          message: 'Proceed?',
          risk: 'high' as const,
          operation: {
            kind: 'command' as const,
            command: 'echo approval',
            argsPreview: { ok: true },
          },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
      },
    });
    const parts = deriveMessageParts(msg, {
      approvalStates: new Map([['call-1', 'denied']]),
    });
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.state).toBe('denied');
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
        action: {
          type: 'approval',
          message: 'Deploy to prod?',
          risk: 'high' as const,
          operation: {
            kind: 'command' as const,
            command: 'echo approval',
            argsPreview: { ok: true },
          },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
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
        action: {
          type: 'approval',
          message: 'Deploy to prod?',
          risk: 'high' as const,
          operation: {
            kind: 'command' as const,
            command: 'echo approval',
            argsPreview: { ok: true },
          },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
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
        action: {
          type: 'approval',
          message: 'Continue?',
          risk: 'high' as const,
          operation: {
            kind: 'command' as const,
            command: 'echo approval',
            argsPreview: { ok: true },
          },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
      },
    });
    // No toolCallPair in context at all
    const parts = deriveMessageParts(msg, {});
    const part = parts[0];
    expect(part?.type === 'tool-approval' && part.toolName).toBe('call-abc');
  });
});

describe('C3 — paired tool-call whose result is action_required', () => {
  // The common transcript shape is a tool-call message paired with its
  // tool-result. The container folds the standalone result row away, so the
  // approval prompt must come from the tool-call branch (with the pair in
  // context) — otherwise paired call+result transcripts would never get
  // Approve/Reject controls. (Cursor Bugbot HIGH.)
  it('emits BOTH a tool-call card and a tool-approval part for a paired action_required result', () => {
    const call = { id: 'call-7', name: 'deploy_to_production', arguments: {} };
    const result = {
      callId: 'call-7',
      outcome: 'action_required' as const,
      content: null,
      action: {
        type: 'approval' as const,
        message: 'Deploy to production?',
        risk: 'high' as const,
        operation: {
          kind: 'command' as const,
          command: 'echo approval',
          argsPreview: { ok: true },
        },
        policyVersion: 'test-policy',
        idempotencyKey: 'test-approval',
      },
    };
    const msg = message({ id: 'tc', role: 'tool-call', toolCall: call });
    const parts = deriveMessageParts(msg, { toolCallPair: { call, result } });

    expect(parts.map((part) => part.type)).toEqual(['tool-call', 'tool-approval']);
    const approval = parts[1];
    expect(approval?.type === 'tool-approval' && approval.toolCallId).toBe('call-7');
    // The tool name resolves from the paired call, not the bare call id.
    expect(approval?.type === 'tool-approval' && approval.toolName).toBe('deploy_to_production');
  });

  it('reflects the mapped state on the paired approval part', () => {
    const call = { id: 'call-7', name: 'deploy', arguments: {} };
    const result = {
      callId: 'call-7',
      outcome: 'action_required' as const,
      content: null,
      action: {
        type: 'approval' as const,
        message: 'Go?',
        risk: 'high' as const,
        operation: {
          kind: 'command' as const,
          command: 'echo approval',
          argsPreview: { ok: true },
        },
        policyVersion: 'test-policy',
        idempotencyKey: 'test-approval',
      },
    };
    const msg = message({ id: 'tc', role: 'tool-call', toolCall: call });
    const parts = deriveMessageParts(msg, {
      toolCallPair: { call, result },
      approvalStates: new Map([['call-7', 'approved']]),
    });
    const approval = parts[1];
    expect(approval?.type === 'tool-approval' && approval.state).toBe('approved');
  });

  it('keeps a paired input action on the neutral tool-call card and never emits approval controls', () => {
    const call = { id: 'call-input', name: 'collect_input', arguments: {} };
    const result = {
      callId: 'call-input',
      outcome: 'action_required' as const,
      content: null,
      action: {
        type: 'input' as const,
        message: 'Provide a deployment reason',
        schema: {
          type: 'object',
          properties: { reason: { type: 'string' } },
          required: ['reason'],
        },
      },
    };
    const msg = message({ id: 'tc-input', role: 'tool-call', toolCall: call });
    const parts = deriveMessageParts(msg, { toolCallPair: { call, result } });

    expect(parts.map((part) => part.type)).toEqual(['tool-call']);
    expect(parts[0]?.type === 'tool-call' && parts[0].pair.result?.action).toEqual(result.action);
  });

  it('a paired SUCCESS result emits only the tool-call card (no approval prompt)', () => {
    const call = { id: 'call-7', name: 'deploy', arguments: {} };
    const result = { callId: 'call-7', outcome: 'success' as const, content: 'done' };
    const msg = message({ id: 'tc', role: 'tool-call', toolCall: call });
    const parts = deriveMessageParts(msg, { toolCallPair: { call, result } });
    expect(parts.map((part) => part.type)).toEqual(['tool-call']);
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

  it('keeps a standalone input action on the neutral tool-result path with prompt and schema intact', () => {
    const action = {
      type: 'input' as const,
      message: 'Provide a deployment reason',
      schema: {
        type: 'object',
        properties: { reason: { type: 'string' } },
        required: ['reason'],
      },
    };
    const msg = message({
      id: 'tr-input',
      role: 'tool-result',
      toolResult: {
        callId: 'call-input',
        outcome: 'action_required',
        content: null,
        action,
      },
    });

    const parts = deriveMessageParts(msg);

    expect(parts[0]?.type).toBe('tool-result');
    expect(parts[0]?.type === 'tool-result' && parts[0].result.action).toEqual(action);
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

  it('context with no approval state does not affect existing parts', () => {
    const msg = message({
      role: 'tool-result',
      toolResult: { callId: 'c', outcome: 'success', content: 'done' },
    });
    const parts = deriveMessageParts(msg, {
      approvalStates: undefined,
      approvalResolutionInFlightIds: undefined,
    });
    expect(parts[0]?.type).toBe('tool-result');
  });
});
