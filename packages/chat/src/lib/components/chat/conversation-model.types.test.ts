/**
 * Interop guard for the Chat conversation data model.
 *
 * Chat should expose the published `conversationalist` types directly instead
 * of a bespoke mirror. These compile-time assertions fail the typecheck if the
 * local bridge drifts from the package surface.
 *
 * Named `*.types.test.ts` so it is covered by typecheck/svelte-check but
 * excluded from the published build (`tsconfig.build.json` excludes `**\/*.test.ts`).
 */

import { expect, test } from 'bun:test';

import type {
  ConversationHistory as ConversationalistConversationHistory,
  Message as ConversationalistMessage,
  MultiModalContent as ConversationalistMultiModalContent,
  ToolCall as ConversationalistToolCall,
  ToolResult as ConversationalistToolResult,
} from 'conversationalist';
import type { ToolCallPair as ConversationalistToolCallPair } from 'conversationalist/utilities';

import type {
  ConversationHistory,
  Message,
  MultiModalContent,
  ToolCall,
  ToolCallPair,
  ToolResult,
} from './conversation-model.ts';

type Assignable<A, B> = A extends B ? true : false;

const publishedHistoryAssignableToCinder: Assignable<
  ConversationalistConversationHistory,
  ConversationHistory
> = true;
const cinderHistoryAssignableToPublished: Assignable<
  ConversationHistory,
  ConversationalistConversationHistory
> = true;
const publishedMessageAssignableToCinder: Assignable<ConversationalistMessage, Message> = true;
const cinderMessageAssignableToPublished: Assignable<Message, ConversationalistMessage> = true;
const publishedToolCallAssignableToCinder: Assignable<ConversationalistToolCall, ToolCall> = true;
const publishedToolResultAssignableToCinder: Assignable<ConversationalistToolResult, ToolResult> =
  true;
const publishedToolCallPairAssignableToCinder: Assignable<
  ConversationalistToolCallPair,
  ToolCallPair
> = true;
const cinderContentAssignableToPublished: Assignable<
  MultiModalContent,
  ConversationalistMultiModalContent
> = true;

const conversationalistMessage = {
  id: 'm1',
  role: 'tool-call',
  content: [{ type: 'text', text: 'running exports check' }] as const,
  position: 3,
  createdAt: '2026-06-02T00:00:00.000Z',
  metadata: {},
  hidden: false,
  toolCall: { id: 'call-1', name: 'exports_check', arguments: { package: '@lostgradient/cinder' } },
} satisfies Message;

const armorerToolCall = {
  id: 'call-1',
  name: 'exports_check',
  arguments: { package: '@lostgradient/cinder' },
} satisfies ToolCall;

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

const extendedThinkingContent = {
  type: 'thinking',
  thinking: 'private reasoning',
  signature: 'signature-1',
} satisfies MultiModalContent;

test('chat conversation model re-exports published Conversationalist types', () => {
  expect(publishedHistoryAssignableToCinder).toBe(true);
  expect(cinderHistoryAssignableToPublished).toBe(true);
  expect(publishedMessageAssignableToCinder).toBe(true);
  expect(cinderMessageAssignableToPublished).toBe(true);
  expect(publishedToolCallAssignableToCinder).toBe(true);
  expect(publishedToolResultAssignableToCinder).toBe(true);
  expect(publishedToolCallPairAssignableToCinder).toBe(true);
  expect(cinderContentAssignableToPublished).toBe(true);
  expect(conversationalistMessage.role).toBe('tool-call');
  expect(armorerToolCall.id).toBe('call-1');
  expect(armorerToolResult.error?.message).toBe('exports map drifted');
  expect(conversationalistHistory.ids).toContain('m1');
  expect(extendedThinkingContent.type).toBe('thinking');
});
