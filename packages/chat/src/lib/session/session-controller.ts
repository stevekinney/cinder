import type {
  ChatAdapter,
  ChatPushHandlers,
  ChatToolApprovalResolution,
} from '../components/chat/adapter/chat-adapter.ts';
import {
  appendMessages,
  appendUserMessage,
  clearMessageDeliveryStatus,
  replaceToolResult,
  rewindBeforeMessage,
} from '../components/chat/builders.ts';
import type {
  ConversationHistory,
  MessageInput,
  ToolAction,
  ToolResult,
} from '../components/chat/conversation-model.ts';
import type { ChatAttachment } from '../components/chat/input/chat-attachment.ts';
import {
  latestResolvedApprovalOwner,
  rebuildApprovalState,
} from './session-controller-approval-state.ts';
import {
  captureHistoryToken as captureToken,
  createSessionRunState,
  invalidateOutstandingWork,
  isHistoryTokenCurrent as isTokenCurrent,
  startSubmission,
} from './session-controller-history.ts';
import { createSessionRunner } from './session-controller-run.ts';
import {
  cleanIncompleteToolRows,
  pruneMessageAttachments,
  type ChatHistoryToken,
  type ChatSessionController,
  type ChatSessionControllerOptions,
} from './session-controller-support.ts';

function fingerprintApprovalAction(action: ToolAction | undefined): string | undefined {
  if (action?.type !== 'approval') return undefined;
  try {
    return JSON.stringify(action);
  } catch {
    return undefined;
  }
}

function currentApprovalFingerprint(
  history: ConversationHistory,
  toolCallId: string,
): string | undefined {
  for (let index = history.ids.length - 1; index >= 0; index -= 1) {
    const result = history.messages[history.ids[index]!]?.toolResult;
    if (result?.callId === toolCallId && result.outcome === 'action_required') {
      return fingerprintApprovalAction(result.action);
    }
  }
  return undefined;
}

function isApprovalOwnerCurrent(
  historyToken: ChatHistoryToken,
  toolCallId: string,
  actionFingerprint: string,
  getConversation: () => ConversationHistory,
  isHistoryTokenCurrent: (token: ChatHistoryToken) => boolean,
): boolean {
  return (
    isHistoryTokenCurrent(historyToken) &&
    currentApprovalFingerprint(getConversation(), toolCallId) === actionFingerprint
  );
}

/** Creates an SSR-safe controller for send, retry, edit, stop, and tool approval flows. */
export function createChatSessionController(
  options: ChatSessionControllerOptions,
): ChatSessionController {
  const maxTurns = options.maxContinuationTurns ?? 5;
  const executionOwner = options.executionOwner ?? 'browser';
  const lifecycle = createSessionRunState();
  const toolOwners = new Map<string, string>();
  const messageAttachments = new Map<string, ChatAttachment[]>();
  const pendingApprovals = new Set<string>();
  const resolvedApprovalOwners = new Set<string>();
  const subscribers = new Set<ChatPushHandlers>();
  const emit = (callback: (handlers: ChatPushHandlers) => void): void => {
    for (const handlers of subscribers) {
      try {
        callback(handlers);
      } catch (error) {
        try {
          reportError(error);
        } catch {
          /* observers are isolated */
        }
      }
    }
  };
  const assertActive = (): void => {
    if (lifecycle.disposed) throw new Error('Chat session is disposed');
    if (lifecycle.running) throw new Error('Chat session is already running');
  };
  const assertNotDisposed = (): void => {
    if (lifecycle.disposed) throw new Error('Chat session is disposed');
  };
  const notifyStreaming = (value: boolean): void => {
    try {
      options.hooks?.onStreamingChange?.(value);
    } catch (error) {
      try {
        options.hooks?.onError?.(error);
      } catch {
        /* observers cannot break lifecycle cleanup */
      }
    }
  };
  const reportError = (error: unknown): void => {
    try {
      options.hooks?.onError?.(error);
    } catch {
      /* error observers cannot replace the operation failure */
    }
  };
  const update = (conversation: ConversationHistory): void => {
    pruneMessageAttachments(conversation, messageAttachments, resolvedApprovalOwners);
    // Every accepted write advances the revision, which is what retires a
    // full-session snapshot someone is still holding a token for.
    lifecycle.revision += 1;
    options.setConversation(conversation);
  };
  const captureHistoryToken = (): ChatHistoryToken =>
    captureToken(lifecycle, options.getConversation().id);
  const isHistoryTokenCurrent = (token: ChatHistoryToken): boolean =>
    isTokenCurrent(lifecycle, options.getConversation().id, token);
  const invalidate = (): void => invalidateOutstandingWork(lifecycle);
  const adoptHistory = (history: ConversationHistory, token: ChatHistoryToken): boolean => {
    // A run owns the conversation while it is streaming into it, and a full
    // snapshot replaces membership outright — installing one mid-run would
    // drop the rows the run is still appending to.
    if (lifecycle.running || !isHistoryTokenCurrent(token) || history.id !== token.conversationId)
      return false;
    update(history);
    return true;
  };
  const { executeRun, stopActiveRun } = createSessionRunner({
    options,
    maxTurns,
    executionOwner,
    lifecycle,
    toolOwners,
    pendingApprovals,
    update,
    emit,
    notifyStreaming,
    reportError,
  });
  const send = async (message: MessageInput, attachments: ChatAttachment[] = []): Promise<void> => {
    assertActive();
    startSubmission(lifecycle);
    const current = options.getConversation();
    const cleaned = cleanIncompleteToolRows(current);
    if (cleaned !== current) update(cleaned);
    const next = appendMessages(cleaned, message);
    update(next);
    const userMessageId = next.ids.at(-1);
    if (userMessageId) {
      messageAttachments.set(userMessageId, [...attachments]);
      await executeRun(userMessageId, attachments);
    }
  };
  const assertNoPendingApprovals = (): void => {
    assertActive();
    rebuildApprovalState(
      options.getConversation(),
      toolOwners,
      pendingApprovals,
      lifecycle.activeUserMessageId,
    );
    if (pendingApprovals.size > 0) {
      throw new Error('Cannot start a new turn while tool approval is pending');
    }
  };
  const completeToolDecision = async (
    id: string,
    owner: string | undefined,
    result: ToolResult,
  ): Promise<'pending' | 'resolved'> => {
    if (result.outcome === 'action_required' && result.action) {
      pendingApprovals.add(id);
      update(replaceToolResult(options.getConversation(), id, result));
      return 'pending';
    }
    pendingApprovals.delete(id);
    if (owner) resolvedApprovalOwners.add(owner);
    update(replaceToolResult(options.getConversation(), id, result));
    if (pendingApprovals.size === 0) {
      const continuationOwner = latestResolvedApprovalOwner(
        options.getConversation(),
        resolvedApprovalOwners,
      );
      resolvedApprovalOwners.clear();
      if (continuationOwner) {
        await executeRun(continuationOwner, messageAttachments.get(continuationOwner) ?? []);
        update(clearMessageDeliveryStatus(options.getConversation(), continuationOwner));
      }
    }
    return 'resolved';
  };

  const adapter: ChatAdapter = {
    sendMessage: async (message, attachments) => {
      assertNoPendingApprovals();
      await send(message, attachments);
    },
    retryMessage: async (messageId) => {
      assertActive();
      startSubmission(lifecycle);
      const history = options.getConversation();
      const message = history.messages[messageId];
      const position = history.ids.indexOf(messageId);
      if (
        !message ||
        message.role !== 'user' ||
        message.metadata['_deliveryStatus'] !== 'failed' ||
        history.ids.slice(position + 1).some((id) => history.messages[id]?.role === 'user')
      )
        throw new Error('Only the latest failed owning user turn can be retried');
      update(
        cleanIncompleteToolRows(
          clearMessageDeliveryStatus(options.getConversation(), messageId),
          messageId,
        ),
      );
      await executeRun(messageId, messageAttachments.get(messageId) ?? []);
    },
    editMessage: async ({ messageId, content }) => {
      assertActive();
      startSubmission(lifecycle);
      const message = options.getConversation().messages[messageId];
      if (!message || message.role !== 'user')
        throw new Error('Only a current user message can be edited');
      const attachments = messageAttachments.get(messageId) ?? [];
      const next = appendUserMessage(
        rewindBeforeMessage(options.getConversation(), messageId),
        content,
      );
      update(next);
      const id = next.ids.at(-1);
      if (id) {
        messageAttachments.set(id, [...attachments]);
        await executeRun(id, attachments);
      }
    },
    stopGenerating: async () => {
      assertNotDisposed();
      await stopActiveRun();
    },
    subscribe: (conversationId, handlers) => {
      if (conversationId !== options.getConversation().id) return () => undefined;
      subscribers.add(handlers);
      return () => {
        subscribers.delete(handlers);
      };
    },
    ...(options.hooks?.resolveToolApproval
      ? {
          resolveToolApproval: async (id: string, resolution) => {
            assertActive();
            rebuildApprovalState(
              options.getConversation(),
              toolOwners,
              pendingApprovals,
              lifecycle.activeUserMessageId,
            );
            if (!pendingApprovals.has(id)) {
              throw new Error('Cannot resolve a tool approval that is not pending');
            }
            const actionFingerprint = currentApprovalFingerprint(options.getConversation(), id);
            if (actionFingerprint === undefined) {
              throw new Error('Cannot resolve a tool approval without a current approval action');
            }
            const owner = toolOwners.get(id) ?? lifecycle.activeUserMessageId;
            const historyToken = captureHistoryToken();
            lifecycle.running = true;
            let result: ToolResult | undefined;
            try {
              result = await options.hooks?.resolveToolApproval?.(id, resolution);
            } catch (error) {
              if (
                !isApprovalOwnerCurrent(
                  historyToken,
                  id,
                  actionFingerprint,
                  options.getConversation,
                  isHistoryTokenCurrent,
                )
              ) {
                return 'pending' satisfies ChatToolApprovalResolution;
              }
              reportError(error);
              throw error;
            } finally {
              lifecycle.running = false;
            }
            assertNotDisposed();
            if (!result) throw new Error('Approval resolution hook must return a tool result');
            if (result.callId !== id) {
              throw new Error(
                'Approval resolution hook returned a result for a different tool call',
              );
            }
            if (
              !isApprovalOwnerCurrent(
                historyToken,
                id,
                actionFingerprint,
                options.getConversation,
                isHistoryTokenCurrent,
              )
            ) {
              return 'pending';
            }
            return completeToolDecision(id, owner, result);
          },
        }
      : {}),
  };
  return {
    adapter,
    stop: stopActiveRun,
    captureHistoryToken,
    isHistoryTokenCurrent,
    adoptHistory,
    invalidate,
    dispose: () => {
      invalidate();
      lifecycle.disposed = true;
      messageAttachments.clear();
    },
  };
}

export {
  createChatSessionController as createChatSession,
  createChatSessionController as createSessionController,
};
