import {
  appendStreamingMessage,
  cancelStreamingMessage,
  finalizeStreamingMessage,
  updateStreamingMessage,
} from 'conversationalist/streaming';
import type {
  ChatAdapter,
  ChatPushHandlers,
  ChatToolResult,
} from '../components/chat/adapter/chat-adapter.ts';
import {
  appendMessages,
  appendToolCall,
  appendToolResult,
  appendUserMessage,
  clearMessageDeliveryStatus,
  markMessageDeliveryFailed,
  removeMessage,
  replaceToolResult,
  rewindBeforeMessage,
} from '../components/chat/builders.ts';
import type {
  ConversationHistory,
  MessageInput,
  ToolResult,
} from '../components/chat/conversation-model.ts';
import type { ChatAttachment } from '../components/chat/input/chat-attachment.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { decodeChatStreamEvents, guardChatStreamEvents } from './stream-event-codec.ts';

/** Request passed to an injected transport for each assistant turn. */
export type ChatSessionRequest = {
  conversation: ConversationHistory;
  signal: AbortSignal;
  turn: number;
  attachments: ChatAttachment[];
};
/** A transport may return decoded events, an NDJSON body, or a Response. */
export type ChatSessionTransportResult =
  | AsyncIterable<ChatStreamEvent>
  | ReadableStream<Uint8Array>
  | Response;
/** Provider-neutral transport seam; the controller decodes NDJSON responses. */
export type ChatSessionTransport = (
  request: ChatSessionRequest,
) => ChatSessionTransportResult | Promise<ChatSessionTransportResult>;
/** Application-owned hooks for tool approval and observability. */
export type ChatSessionHooks = {
  onToolResult?: (result: ChatToolResult) => void;
  approveToolCall?: (toolCallId: string) => Promise<ToolResult | undefined>;
  denyToolCall?: (toolCallId: string) => Promise<ToolResult | undefined>;
  onError?: (error: unknown) => void;
  onStreamingChange?: (streaming: boolean) => void;
};
/** Configuration for {@link createChatSessionController}. */
export type ChatSessionControllerOptions = {
  transport: ChatSessionTransport;
  getConversation: () => ConversationHistory;
  setConversation: (conversation: ConversationHistory) => void;
  maxContinuationTurns?: number;
  hooks?: ChatSessionHooks;
};
/** Controller and Chat adapter backed by an injected, provider-neutral transport. */
export type ChatSessionController = {
  adapter: ChatAdapter;
  stop: () => Promise<void>;
  dispose: () => void;
};

/** Creates an SSR-safe controller for send, retry, edit, stop, and tool approval flows. */
export function createChatSessionController(
  options: ChatSessionControllerOptions,
): ChatSessionController {
  const maxTurns = options.maxContinuationTurns ?? 5;
  let active: AbortController | undefined;
  let disposed = false;
  let running = false;
  let activeRun: Promise<void> | undefined;
  let activeUserMessageId: string | undefined;
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
    if (disposed) throw new Error('Chat session is disposed');
    if (running) throw new Error('Chat session is already running');
  };
  const assertNotDisposed = (): void => {
    if (disposed) throw new Error('Chat session is disposed');
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
  const findOwningUser = (history: ConversationHistory, toolCallId: string): string => {
    const position = history.ids.indexOf(toolCallId);
    for (let index = position - 1; index >= 0; index -= 1) {
      const message = history.messages[history.ids[index]!];
      if (message?.role === 'user') return message.id;
    }
    return activeUserMessageId ?? '';
  };
  const rebuildApprovalState = (): void => {
    toolOwners.clear();
    pendingApprovals.clear();
    const history = options.getConversation();
    for (const id of history.ids) {
      const message = history.messages[id];
      if (!message) continue;
      if (message.role === 'tool-call' && message.toolCall)
        toolOwners.set(message.toolCall.id, findOwningUser(history, id));
      if (message.role === 'tool-result' && message.toolResult) {
        if (message.toolResult.outcome === 'action_required' && message.toolResult.action) {
          pendingApprovals.add(message.toolResult.callId);
        } else {
          pendingApprovals.delete(message.toolResult.callId);
        }
      }
    }
  };
  const latestResolvedApprovalOwner = (history: ConversationHistory): string | undefined => {
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
  };

  const pruneMessageAttachments = (history: ConversationHistory): void => {
    const retainedOwners = new Set<string>();
    const callOwners = new Map<string, string>();
    let latestUserMessageId: string | undefined;
    for (const id of history.ids) {
      const message = history.messages[id];
      if (message?.role === 'user') {
        latestUserMessageId = id;
        retainedOwners.add(id);
      }
      if (message?.role === 'tool-call' && message.toolCall) {
        if (latestUserMessageId) callOwners.set(message.toolCall.id, latestUserMessageId);
      }
      if (message?.role === 'tool-result' && message.toolResult) {
        const owner = callOwners.get(message.toolResult.callId);
        if (
          message.toolResult.outcome === 'action_required' &&
          message.toolResult.action &&
          owner
        ) {
          retainedOwners.add(owner);
        }
      }
    }
    for (const owner of resolvedApprovalOwners) retainedOwners.add(owner);
    for (const id of messageAttachments.keys()) {
      if (!retainedOwners.has(id)) messageAttachments.delete(id);
    }
  };
  const update = (conversation: ConversationHistory): void => {
    pruneMessageAttachments(conversation);
    options.setConversation(conversation);
  };
  const decodeTransportResult = async (
    result: ChatSessionTransportResult,
    onProtocolError: (error: unknown) => void,
  ): Promise<AsyncIterable<ChatStreamEvent>> => {
    // The abort is handed to the decoder rather than left to the catch below:
    // a rejection reaches this command only after the producer's own cleanup
    // has been awaited, so a transport whose cleanup waits on the signal
    // would deadlock if the signal could not be raised until then.
    const decodeOptions = { onProtocolError };
    if (result instanceof Response) {
      if (!result.ok || !result.body) throw new Error(await result.text());
      return decodeChatStreamEvents(result.body, decodeOptions);
    }
    if (result instanceof ReadableStream) return decodeChatStreamEvents(result, decodeOptions);
    // Already-decoded events still get the request-local stream guard, so a
    // typed transport is held to the same terminal, sequence, and envelope
    // rules as an NDJSON one.
    return guardChatStreamEvents(result, decodeOptions);
  };
  const run = async (userMessageId: string, attachments: ChatAttachment[] = []): Promise<void> => {
    assertActive();
    running = true;
    activeUserMessageId = userMessageId;
    let turn = 0;
    notifyStreaming(true);
    try {
      while (++turn <= maxTurns) {
        const before = options.getConversation();
        const started = appendStreamingMessage(before, 'assistant');
        update(started.conversation);
        const messageId = started.messageId;
        emit((handlers) => handlers.onStreamBegin(messageId));
        const controller = new AbortController();
        // A protocol failure aborts the transport at the throw site (see
        // `decodeTransportResult`), so by the time the rejection arrives the
        // signal is already aborted. Remembering WHY keeps that from reading
        // as a user cancellation, which would swallow the error.
        let protocolFailure = false;
        active = controller;
        let text = '';
        let toolResultSeen = false;
        let approvalRequired = false;
        let committed = before;
        const toolCalls = new Set<string>();
        const toolResults = new Set<string>();
        try {
          const events = await decodeTransportResult(
            await options.transport({
              conversation: before,
              signal: controller.signal,
              turn,
              attachments,
            }),
            () => {
              // A frame can fail validation after the user has already
              // stopped: the transport may still deliver a queued malformed
              // frame. That is a cancellation, not a protocol failure — the
              // command must still resolve cleanly — so the cause is only
              // recorded when nothing had aborted this turn yet.
              if (!controller.signal.aborted) protocolFailure = true;
              controller.abort();
            },
          );
          for await (const event of events) {
            if (controller.signal.aborted && !protocolFailure) break;
            if (event.type === 'text') {
              text += event.text;
              emit((handlers) => handlers.onTokenPush(event.text));
              update(updateStreamingMessage(options.getConversation(), messageId, text));
            } else if (event.type === 'tool_call') {
              update(
                appendToolCall(options.getConversation(), {
                  id: event.id,
                  name: event.name,
                  arguments: event.arguments,
                }),
              );
              toolOwners.set(event.id, userMessageId);
              toolCalls.add(event.id);
              committed = options.getConversation();
            } else if (event.type === 'tool_result') {
              toolResultSeen = true;
              toolResults.add(event.callId);
              const requiresApproval =
                event.outcome === 'action_required' && event.action !== undefined;
              approvalRequired ||= requiresApproval;
              if (requiresApproval) pendingApprovals.add(event.callId);
              else pendingApprovals.delete(event.callId);
              update(appendToolResult(options.getConversation(), event));
              committed = options.getConversation();
              try {
                options.hooks?.onToolResult?.(event);
              } catch (observerError) {
                reportError(observerError);
              }
            }
            // CIN-507 extends the codec's vocabulary (`stream:*`, `tool.*`,
            // `run.*`) without wiring a reducer for it yet — that lands with
            // the route that emits these frames (a separate, out-of-scope
            // issue). Unrecognized-here members fall through as a no-op
            // rather than crash this loop.
          }
          update(
            text
              ? finalizeStreamingMessage(options.getConversation(), messageId)
              : cancelStreamingMessage(options.getConversation(), messageId),
          );
          if (controller.signal.aborted && !protocolFailure) return;
        } catch (error) {
          if (controller.signal.aborted && !protocolFailure) {
            update(
              text
                ? finalizeStreamingMessage(options.getConversation(), messageId)
                : cancelStreamingMessage(options.getConversation(), messageId),
            );
            return;
          }
          // The transport's signal is the only way it learns the command
          // failed. A stream-guard rejection (malformed frame, non-increasing
          // sequence, mixed envelope) surfaces here while the transport's
          // provider or background work may still be running on that signal,
          // so abort it before rolling back and reporting. A protocol failure
          // has already aborted at its throw site; this covers every other
          // way the turn can fail, and aborting twice is a no-op.
          controller.abort();
          update(
            markMessageDeliveryFailed(cancelStreamingMessage(committed, messageId), userMessageId),
          );
          reportError(error);
          throw error;
        } finally {
          emit((handlers) => handlers.onStreamEnd());
          if (active === controller) active = undefined;
        }
        if (
          !toolResultSeen ||
          approvalRequired ||
          [...toolCalls].some((id) => !toolResults.has(id))
        )
          return;
      }
      const error = new Error(`Reached the tool-call continuation limit (${maxTurns}).`);
      update(markMessageDeliveryFailed(options.getConversation(), userMessageId));
      reportError(error);
      throw error;
    } finally {
      running = false;
      notifyStreaming(false);
    }
  };
  const executeRun = async (
    userMessageId: string,
    attachments: ChatAttachment[] = [],
  ): Promise<void> => {
    const promise = run(userMessageId, attachments);
    activeRun = promise;
    try {
      await promise;
    } finally {
      if (activeRun === promise) activeRun = undefined;
    }
  };
  const stopActiveRun = async (): Promise<void> => {
    active?.abort();
    // The initiating send/retry owns any run rejection. Stop only promises
    // that the run has settled and released the controller for its next turn.
    try {
      await activeRun;
    } catch {
      // The initiating promise remains the owner of the rejection.
    }
  };
  const send = async (message: MessageInput, attachments: ChatAttachment[] = []): Promise<void> => {
    assertActive();
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
  const cleanIncompleteToolRows = (
    history: ConversationHistory,
    userMessageId?: string,
  ): ConversationHistory => {
    const start = userMessageId ? history.ids.indexOf(userMessageId) : -1;
    const suffix = history.ids.slice(start + 1);
    const calls = new Set<string>();
    const results = new Set<string>();
    for (const id of suffix) {
      const message = history.messages[id];
      if (message?.role === 'tool-call' && message.toolCall) calls.add(message.toolCall.id);
      if (message?.role === 'tool-result' && message.toolResult)
        results.add(message.toolResult.callId);
    }
    const incomplete = suffix.filter((id) => {
      const message = history.messages[id];
      return (
        (message?.role === 'tool-call' && message.toolCall && !results.has(message.toolCall.id)) ||
        (message?.role === 'tool-result' &&
          message.toolResult &&
          !calls.has(message.toolResult.callId))
      );
    });
    return incomplete.toReversed().reduce((current, id) => removeMessage(current, id), history);
  };
  const assertNoPendingApprovals = (): void => {
    assertActive();
    rebuildApprovalState();
    if (pendingApprovals.size > 0) {
      throw new Error('Cannot start a new turn while tool approval is pending');
    }
  };
  const adapter: ChatAdapter = {
    sendMessage: async (message, attachments) => {
      assertNoPendingApprovals();
      await send(message, attachments);
    },
    retryMessage: async (messageId) => {
      assertActive();
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
    ...(options.hooks?.approveToolCall
      ? {
          approveToolCall: async (id: string) => {
            assertActive();
            rebuildApprovalState();
            const owner = toolOwners.get(id) ?? activeUserMessageId;
            running = true;
            let result: ToolResult | undefined;
            try {
              result = await options.hooks?.approveToolCall?.(id);
            } catch (error) {
              reportError(error);
              throw error;
            } finally {
              running = false;
            }
            assertNotDisposed();
            if (!result) throw new Error('Approval hook must return a tool result');
            if (result.outcome === 'action_required' && result.action) {
              pendingApprovals.add(id);
              update(replaceToolResult(options.getConversation(), id, result));
              return 'pending';
            } else {
              pendingApprovals.delete(id);
              if (owner) resolvedApprovalOwners.add(owner);
            }
            update(replaceToolResult(options.getConversation(), id, result));
            if (pendingApprovals.size === 0) {
              const continuationOwner = latestResolvedApprovalOwner(options.getConversation());
              resolvedApprovalOwners.clear();
              if (continuationOwner) {
                await executeRun(
                  continuationOwner,
                  messageAttachments.get(continuationOwner) ?? [],
                );
                update(clearMessageDeliveryStatus(options.getConversation(), continuationOwner));
              }
            }
            return 'resolved';
          },
        }
      : {}),
    ...(options.hooks?.denyToolCall
      ? {
          denyToolCall: async (id: string) => {
            assertActive();
            rebuildApprovalState();
            const owner = toolOwners.get(id) ?? activeUserMessageId;
            running = true;
            let result: ToolResult | undefined;
            try {
              result = await options.hooks?.denyToolCall?.(id);
            } catch (error) {
              reportError(error);
              throw error;
            } finally {
              running = false;
            }
            assertNotDisposed();
            if (!result) throw new Error('Denial hook must return a tool result');
            if (result.outcome === 'action_required' && result.action) {
              pendingApprovals.add(id);
              update(replaceToolResult(options.getConversation(), id, result));
              return 'pending';
            } else {
              pendingApprovals.delete(id);
              if (owner) resolvedApprovalOwners.add(owner);
            }
            update(replaceToolResult(options.getConversation(), id, result));
            if (pendingApprovals.size === 0) {
              const continuationOwner = latestResolvedApprovalOwner(options.getConversation());
              resolvedApprovalOwners.clear();
              if (continuationOwner) {
                await executeRun(
                  continuationOwner,
                  messageAttachments.get(continuationOwner) ?? [],
                );
                update(clearMessageDeliveryStatus(options.getConversation(), continuationOwner));
              }
            }
            return 'resolved';
          },
        }
      : {}),
  };
  return {
    adapter,
    stop: stopActiveRun,
    dispose: () => {
      disposed = true;
      active?.abort();
      messageAttachments.clear();
    },
  };
}

export {
  createChatSessionController as createChatSession,
  createChatSessionController as createSessionController,
};
