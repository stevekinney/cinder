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
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { decodeChatStreamEvents } from './stream-event-codec.ts';

/** Request passed to an injected transport for each assistant turn. */
export type ChatSessionRequest = {
  conversation: ConversationHistory;
  signal: AbortSignal;
  turn: number;
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
  const run = async (userMessageId: string): Promise<void> => {
    let turn = 0;
    options.hooks?.onStreamingChange?.(true);
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
        try {
          const events = await decodeTransportResult(
            await options.transport({
              conversation: options.getConversation(),
              signal: controller.signal,
              turn,
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
            } else {
              toolResultSeen = true;
              approvalRequired = event.outcome === 'action_required';
              update(appendToolResult(options.getConversation(), event));
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
          update(
            text
              ? finalizeStreamingMessage(options.getConversation(), messageId)
              : cancelStreamingMessage(options.getConversation(), messageId),
          );
          if (controller.signal.aborted) return;
          update(markMessageDeliveryFailed(options.getConversation(), userMessageId));
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
      options.hooks?.onStreamingChange?.(false);
    }
  };
  const send = async (message: MessageInput): Promise<void> => {
    if (disposed) throw new Error('Chat session is disposed');
    const next = appendMessages(options.getConversation(), message);
    update(next);
    const userMessageId = next.ids.at(-1);
    if (userMessageId) await run(userMessageId);
  };
  const adapter: ChatAdapter = {
    sendMessage: async (message) => send(message),
    retryMessage: async (messageId) => {
      update(clearMessageDeliveryStatus(options.getConversation(), messageId));
      await run(messageId);
    },
    editMessage: async ({ messageId, content }) => {
      const next = appendUserMessage(
        rewindBeforeMessage(options.getConversation(), messageId),
        content,
      );
      update(next);
      const id = next.ids.at(-1);
      if (id) await run(id);
    },
    stopGenerating: async () => {
      active?.abort();
    },
    approveToolCall: async (id) => {
      const result = await options.hooks?.approveToolCall?.(id);
      if (result) {
        update(replaceToolResult(options.getConversation(), id, result));
        await run(id);
      }
    },
    denyToolCall: async (id) => {
      const result = await options.hooks?.denyToolCall?.(id);
      if (result) {
        update(replaceToolResult(options.getConversation(), id, result));
        await run(id);
      }
    },
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
