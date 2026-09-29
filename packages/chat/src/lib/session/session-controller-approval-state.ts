import type { ConversationHistory } from '../components/chat/conversation-model.ts';

export function findOwningUser(
  history: ConversationHistory,
  toolCallId: string,
  activeUserMessageId: string | undefined,
): string {
  const position = history.ids.indexOf(toolCallId);
  for (let index = position - 1; index >= 0; index -= 1) {
    const message = history.messages[history.ids[index]!];
    if (message?.role === 'user') return message.id;
  }
  return activeUserMessageId ?? '';
}

export function rebuildApprovalState(
  history: ConversationHistory,
  toolOwners: Map<string, string>,
  pendingApprovals: Set<string>,
  activeUserMessageId: string | undefined,
): void {
  toolOwners.clear();
  pendingApprovals.clear();
  for (const id of history.ids) {
    const message = history.messages[id];
    if (!message) continue;
    if (message.role === 'tool-call' && message.toolCall)
      toolOwners.set(message.toolCall.id, findOwningUser(history, id, activeUserMessageId));
    if (message.role === 'tool-result' && message.toolResult) {
      if (message.toolResult.outcome === 'action_required' && message.toolResult.action)
        pendingApprovals.add(message.toolResult.callId);
      else pendingApprovals.delete(message.toolResult.callId);
    }
  }
}

export function latestResolvedApprovalOwner(
  history: ConversationHistory,
  resolvedApprovalOwners: Set<string>,
): string | undefined {
  let latestOwner: string | undefined;
  let latestPosition = -1;
  for (const owner of resolvedApprovalOwners) {
    const position = history.ids.indexOf(owner);
    if (position > latestPosition) {
      latestOwner = owner;
      latestPosition = position;
    }
  }
  return latestOwner;
}
