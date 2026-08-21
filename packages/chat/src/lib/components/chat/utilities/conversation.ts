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
 * Finds the latest `tool-result` message for each tool-call id—matching
 * {@link pairToolCallsWithResults}'s last-result-wins semantics, so a
 * superseded `action_required` result is never mistaken for the current one.
 */
function latestToolResultsByCallId(
  messages: ReadonlyArray<Message>,
): Map<string, ToolResultMessage> {
  const latest = new Map<string, ToolResultMessage>();
  for (const message of messages) {
    if (isToolResultMessage(message)) {
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
 * for the same call id exists earlier in the transcript.
 */
export function getUnresolvedToolApprovals(
  conversation: ConversationHistory,
  options: { includeHidden?: boolean } = {},
): UnresolvedToolApproval[] {
  const approvals: UnresolvedToolApproval[] = [];
  for (const message of latestToolResultsByCallId(getMessages(conversation, options)).values()) {
    const result = message.toolResult;
    if (hasPendingAction(result)) {
      approvals.push({ message, result });
    }
  }
  return approvals;
}

/**
 * Finds the current `tool-result` message for a tool-call id—the latest one
 * if the transcript carries more than one, matching
 * {@link pairToolCallsWithResults}'s last-result-wins semantics.
 */
export function findToolResultMessage(
  conversation: ConversationHistory,
  toolCallId: string,
  options: { includeHidden?: boolean } = {},
): ToolResultMessage | undefined {
  return latestToolResultsByCallId(getMessages(conversation, options)).get(toolCallId);
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
