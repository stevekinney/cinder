import {
  appendStreamingMessage,
  cancelStreamingMessage,
  finalizeStreamingMessage,
  updateStreamingMessage,
} from 'conversationalist/streaming';
import type { ChatAdapter } from '../components/chat/adapter/chat-adapter.ts';
import {
  appendMessages,
  appendToolCall,
  appendToolResult,
  appendUserMessage,
  clearMessageDeliveryStatus,
  markMessageDeliveryFailed,
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
import { decodeChatStreamEvents } from './stream-event-codec.ts';

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
  onToolResult?: (result: ToolResult) => void;
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
  let activeUserMessageId: string | undefined;
  const toolOwners = new Map<string, string>();
  const messageAttachments = new Map<string, ChatAttachment[]>();
  const pendingApprovals = new Set<string>();
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
        if (message.toolResult.outcome === 'action_required')
          pendingApprovals.add(message.toolResult.callId);
        else pendingApprovals.delete(message.toolResult.callId);
      }
    }
  };

  const update = (conversation: ConversationHistory): void => options.setConversation(conversation);
  const decodeTransportResult = async (
    result: ChatSessionTransportResult,
  ): Promise<AsyncIterable<ChatStreamEvent>> => {
    if (result instanceof Response) {
      if (!result.ok || !result.body) throw new Error(await result.text());
      return decodeChatStreamEvents(result.body);
    }
    if (result instanceof ReadableStream) return decodeChatStreamEvents(result);
    return result;
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
        const controller = new AbortController();
        active = controller;
        let text = '';
        let toolResultSeen = false;
        let approvalRequired = false;
        let committed = before;
        try {
          const events = await decodeTransportResult(
            await options.transport({
              conversation: before,
              signal: controller.signal,
              turn,
              attachments,
            }),
          );
          for await (const event of events) {
            if (controller.signal.aborted) break;
            if (event.type === 'text') {
              text += event.text;
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
              committed = options.getConversation();
            } else {
              toolResultSeen = true;
              approvalRequired ||= event.outcome === 'action_required';
              if (event.outcome === 'action_required') pendingApprovals.add(event.callId);
              else pendingApprovals.delete(event.callId);
              update(appendToolResult(options.getConversation(), event));
              committed = options.getConversation();
              options.hooks?.onToolResult?.(event);
            }
          }
          update(
            text
              ? finalizeStreamingMessage(options.getConversation(), messageId)
              : cancelStreamingMessage(options.getConversation(), messageId),
          );
          if (controller.signal.aborted) return;
        } catch (error) {
          if (controller.signal.aborted) {
            update(
              text
                ? finalizeStreamingMessage(options.getConversation(), messageId)
                : cancelStreamingMessage(options.getConversation(), messageId),
            );
            return;
          }
          update(
            markMessageDeliveryFailed(cancelStreamingMessage(committed, messageId), userMessageId),
          );
          options.hooks?.onError?.(error);
          throw error;
        } finally {
          if (active === controller) active = undefined;
        }
        if (!toolResultSeen || approvalRequired) return;
      }
      const error = new Error(`Reached the tool-call continuation limit (${maxTurns}).`);
      update(markMessageDeliveryFailed(options.getConversation(), userMessageId));
      options.hooks?.onError?.(error);
      throw error;
    } finally {
      running = false;
      notifyStreaming(false);
    }
  };
  const send = async (message: MessageInput, attachments: ChatAttachment[] = []): Promise<void> => {
    assertActive();
    const next = appendMessages(options.getConversation(), message);
    update(next);
    const userMessageId = next.ids.at(-1);
    if (userMessageId) {
      messageAttachments.set(userMessageId, [...attachments]);
      await run(userMessageId, attachments);
    }
  };
  const adapter: ChatAdapter = {
    sendMessage: async (message, attachments) => send(message, attachments),
    retryMessage: async (messageId) => {
      assertActive();
      const history = options.getConversation();
      const message = history.messages[messageId];
      if (!message || message.role !== 'user' || history.ids.at(-1) !== messageId)
        throw new Error('Only the latest failed user message can be retried');
      update(clearMessageDeliveryStatus(options.getConversation(), messageId));
      await run(messageId, messageAttachments.get(messageId) ?? []);
    },
    editMessage: async ({ messageId, content }) => {
      assertActive();
      const next = appendUserMessage(
        rewindBeforeMessage(options.getConversation(), messageId),
        content,
      );
      update(next);
      const id = next.ids.at(-1);
      if (id) await run(id, messageAttachments.get(messageId) ?? []);
    },
    stopGenerating: async () => {
      assertNotDisposed();
      active?.abort();
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
              if (owner) update(markMessageDeliveryFailed(options.getConversation(), owner));
              options.hooks?.onError?.(error);
              throw error;
            } finally {
              running = false;
            }
            if (result) {
              update(replaceToolResult(options.getConversation(), id, result));
              pendingApprovals.delete(id);
              if (owner && pendingApprovals.size === 0)
                await run(owner, messageAttachments.get(owner) ?? []);
            }
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
              if (owner) update(markMessageDeliveryFailed(options.getConversation(), owner));
              options.hooks?.onError?.(error);
              throw error;
            } finally {
              running = false;
            }
            if (result) {
              update(replaceToolResult(options.getConversation(), id, result));
              pendingApprovals.delete(id);
              if (owner && pendingApprovals.size === 0)
                await run(owner, messageAttachments.get(owner) ?? []);
            }
          },
        }
      : {}),
  };
  return {
    adapter,
    stop: async () => active?.abort(),
    dispose: () => {
      disposed = true;
      active?.abort();
    },
  };
}

export {
  createChatSessionController as createChatSession,
  createChatSessionController as createSessionController,
};
