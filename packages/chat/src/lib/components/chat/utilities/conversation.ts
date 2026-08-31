/**
 * Conversation-reading helpers for Chat.
 *
 * These helpers operate on the Conversationalist transcript shape while keeping
 * Cinder's browser runtime free of the full conversation package.
 */

import type {
  ConversationHistory,
  Message,
  ToolAction,
  ToolCall,
  ToolCallPair,
  ToolResult,
} from '../conversation-model.ts';

export function getMessages(
  conversation: ConversationHistory,
  options: { includeHidden?: boolean } = {},
): Message[] {
  return conversation.ids
    .map((id) => conversation.messages[id])
    .filter((message): message is Message => message !== undefined)
    .filter((message) => options.includeHidden === true || !message.hidden);
}

/** A `tool-result` message whose `toolResult` is guaranteed present. */
export type ToolResultMessage = Message & { role: 'tool-result'; toolResult: ToolResult };

function isToolResultMessage(message: Message): message is ToolResultMessage {
  return message.role === 'tool-result' && message.toolResult !== undefined;
}

/** A `tool-result` message parked on `action_required` with a pending action. */
export type UnresolvedToolApproval = {
  message: ToolResultMessage;
  result: ToolResult & { action: ToolAction };
};

function hasPendingAction(result: ToolResult): result is ToolResult & { action: ToolAction } {
  return result.outcome === 'action_required' && result.action !== undefined;
}

/**
 * Finds the latest `tool-result` message for each tool-call id, over the
 * COMPLETE ordered transcript (hidden messages included). This helper uses
 * last-result-wins semantics for APIs that address a call by ID, while
 * `pairToolCallsWithResults` pairs repeated occurrences independently.
 * Iteration order follows each call's latest occurrence: `Map#set` does not
 * reorder an existing key, so an existing entry is deleted before being
 * re-set.
 */
function latestToolResultsByCallId(
  conversation: ConversationHistory,
): Map<string, ToolResultMessage> {
  const latest = new Map<string, ToolResultMessage>();
  for (const message of getMessages(conversation, { includeHidden: true })) {
    if (isToolResultMessage(message)) {
      latest.delete(message.toolResult.callId);
      latest.set(message.toolResult.callId, message);
    }
  }
  return latest;
}

/**
 * Finds every tool call whose latest `tool-result` is still parked on
 * `action_required` with an action present—i.e. not yet resolved via
 * `replaceToolResult`. A call whose latest result has since moved to
 * `success`/`error` is excluded, even if an earlier `action_required` result
 * for the same call id exists earlier in the transcript, or the resolving
 * result is itself hidden. By default a hidden latest result is excluded
 * from the returned list, matching `getMessages`; pass `includeHidden: true`
 * to include it.
 */
export function getUnresolvedToolApprovals(
  conversation: ConversationHistory,
  options: { includeHidden?: boolean } = {},
): UnresolvedToolApproval[] {
  const approvals: UnresolvedToolApproval[] = [];
  for (const message of latestToolResultsByCallId(conversation).values()) {
    if (!options.includeHidden && message.hidden) continue;
    const result = message.toolResult;
    if (hasPendingAction(result)) {
      approvals.push({ message, result });
    }
  }
  return approvals;
}

/**
 * Finds the current `tool-result` message for a tool-call id—the latest one
 * if the transcript carries more than one. By default a hidden latest result
 * is treated as not found, matching `getMessages`; pass `includeHidden: true`
 * to return it.
 */
export function findToolResultMessage(
  conversation: ConversationHistory,
  toolCallId: string,
  options: { includeHidden?: boolean } = {},
): ToolResultMessage | undefined {
  const message = latestToolResultsByCallId(conversation).get(toolCallId);
  if (!message || (!options.includeHidden && message.hidden)) return undefined;
  return message;
}

/**
 * Pairs tool calls with role-valid tool results from an already-ordered message
 * array. Repeated IDs are paired by occurrence, rather than by ID alone, so a
 * result can only satisfy one call occurrence.
 */
export function pairToolCallsWithResults(messages: ReadonlyArray<Message>): ToolCallPair[] {
  const callsById = new Map<string, ToolCall[]>();
  const resultsByCallId = new Map<string, ToolResult[]>();

  for (const message of messages) {
    if (message.role === 'tool-call' && message.toolCall !== undefined) {
      const calls = callsById.get(message.toolCall.id);
      if (calls) calls.push(message.toolCall);
      else callsById.set(message.toolCall.id, [message.toolCall]);
    }
    if (message.role === 'tool-result' && message.toolResult !== undefined) {
      const results = resultsByCallId.get(message.toolResult.callId);
      if (results) results.push(message.toolResult);
      else resultsByCallId.set(message.toolResult.callId, [message.toolResult]);
    }
  }

  const callOccurrences = new Map<string, number>();
  const pairs: ToolCallPair[] = [];
  for (const message of messages) {
    if (message.role !== 'tool-call' || message.toolCall === undefined) continue;
    const occurrence = callOccurrences.get(message.toolCall.id) ?? 0;
    const results = resultsByCallId.get(message.toolCall.id) ?? [];
    pairs.push({ call: message.toolCall, result: results[occurrence] });
    callOccurrences.set(message.toolCall.id, occurrence + 1);
  }

  return pairs;
}
