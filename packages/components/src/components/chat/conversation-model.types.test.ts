/**
 * Interop guard for the vendored conversation data model.
 *
 * Chat's whole reason for vendoring its own types is "max interop": a value
 * produced by `conversationalist` (a `Message`/`ToolCall`) or by `armorer`
 * (a tool call `{ id, name, arguments }` / a tool result
 * `{ callId, outcome, content }`) must satisfy the vendored types with ZERO
 * casts. These compile-time `satisfies` assertions fail the typecheck if that
 * structural compatibility ever drifts.
 *
 * Named `*.types.test.ts` so it is covered by typecheck/svelte-check but
 * excluded from the published build (`tsconfig.build.json` excludes `**\/*.test.ts`).
 */

import { expect, test } from 'bun:test';

import type { ConversationHistory, Message, ToolCall, ToolResult } from './conversation-model.ts';

// A message exactly as `conversationalist` materializes it (immutable shape,
// readonly content array, tool-call role). Must satisfy the vendored `Message`.
const conversationalistMessage = {
  id: 'm1',
  role: 'tool-call',
  content: [{ type: 'text', text: 'running exports check' }] as const,
  position: 3,
  createdAt: '2026-06-02T00:00:00.000Z',
  metadata: {},
  hidden: false,
  toolCall: { id: 'call-1', name: 'exports_check', arguments: { package: 'cinder' } },
} satisfies Message;

// A tool call exactly as `armorer.createToolCall(...)` returns it.
const armorerToolCall = {
  id: 'call-1',
  name: 'exports_check',
  arguments: { package: 'cinder' },
} satisfies ToolCall;

// A tool result exactly as `armorer`/`interoperability` materializes it,
// including the structured `error` object (not a string).
const armorerToolResult = {
  callId: 'call-1',
  outcome: 'error',
  content: null,
  error: {
    code: 'E_DRIFT',
    category: 'conflict',
    retryable: false,
    message: 'exports map drifted',
  },
} satisfies ToolResult;

// A conversation snapshot exactly as `createConversationHistory(...)` produces it.
const conversationalistHistory = {
  schemaVersion: 4,
  id: 'conversation-1',
  status: 'active',
  metadata: {},
  ids: ['m1'],
  messages: { m1: conversationalistMessage },
  createdAt: '2026-06-02T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
} satisfies ConversationHistory;

test('vendored conversation model stays structurally compatible with conversationalist + armorer', () => {
  // The `satisfies` checks above are the real assertion (compile-time). These
  // runtime expectations keep the file a live test and pin a couple of values.
  expect(conversationalistMessage.role).toBe('tool-call');
  expect(armorerToolCall.id).toBe('call-1');
  expect(armorerToolResult.error?.message).toBe('exports map drifted');
  expect(conversationalistHistory.ids).toContain('m1');
});
