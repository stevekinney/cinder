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

/** A `tool-result` message parked on `action_required` with a pending action. */
export type UnresolvedToolApproval = {
  message: Message;
  result: ToolResult & { action: ToolAction };
};

function hasPendingAction(result: ToolResult): result is ToolResult & { action: ToolAction } {
  return result.outcome === 'action_required' && result.action !== undefined;
}

/**
 * Finds every `tool-result` message still parked on `action_required` with an
 * action present—i.e. not yet resolved via `replaceToolResult`.
 */
export function getUnresolvedToolApprovals(
  conversation: ConversationHistory,
  options: { includeHidden?: boolean } = {},
): UnresolvedToolApproval[] {
  const approvals: UnresolvedToolApproval[] = [];
  for (const message of getMessages(conversation, options)) {
    const result = message.toolResult;
    if (message.role === 'tool-result' && result && hasPendingAction(result)) {
      approvals.push({ message, result });
    }
  }
  return approvals;
}

/** Finds the `tool-result` message whose result carries the given tool-call id. */
export function findToolResultMessage(
  conversation: ConversationHistory,
  toolCallId: string,
  options: { includeHidden?: boolean } = {},
): Message | undefined {
  return getMessages(conversation, options).find(
    (message) => message.role === 'tool-result' && message.toolResult?.callId === toolCallId,
  );
}

/** Pairs tool calls with role-valid tool results from an already-ordered message array. */
export function pairToolCallsWithResults(messages: ReadonlyArray<Message>): ToolCallPair[] {
  const resultsByCallId = new Map<string, ToolResult>();
  for (const message of messages) {
    if (message.role === 'tool-result' && message.toolResult !== undefined) {
      resultsByCallId.set(message.toolResult.callId, message.toolResult);
    }
  }

  const pairs: ToolCallPair[] = [];
  for (const message of messages) {
    if (message.role === 'tool-call' && message.toolCall !== undefined) {
      pairs.push({
        call: message.toolCall,
        result: resultsByCallId.get(message.toolCall.id),
      });
    }
  }
  return pairs;
}
