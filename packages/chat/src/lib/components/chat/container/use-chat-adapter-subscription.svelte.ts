import { untrack } from 'svelte';

import type { ChatAdapter, ChatPushHandlers } from '../adapter/chat-adapter.ts';
import type { Message } from '../conversation-model.ts';
import type { useChatReadReceipts } from './use-chat-read-receipts.svelte.ts';
import type { useChatStreamingState } from './use-chat-streaming-state.svelte.ts';
import type { useChatTypingIndicator } from './use-chat-typing-indicator.svelte.ts';

type StreamingActions = Pick<
  ReturnType<typeof useChatStreamingState>,
  'beginStreaming' | 'pushToken' | 'endStreaming'
>;
type TypingActions = Pick<
  ReturnType<typeof useChatTypingIndicator>,
  'handleAdapterTypingChange' | 'reset'
>;
type ReceiptActions = Pick<
  ReturnType<typeof useChatReadReceipts>,
  'handleAdapterReadReceipt' | 'reset'
>;

export type ChatAdapterSubscriptionOptions = {
  getAdapter: () => ChatAdapter | undefined;
  getConversationId: () => string;
  getOnMessage: () => ((message: Message) => void) | undefined;
  getOnTypingChange: () => ChatPushHandlers['onTypingChange'] | undefined;
  getOnReadReceipt: () => ChatPushHandlers['onReadReceipt'] | undefined;
  getStreamingActions: () => StreamingActions;
  getTypingActions: () => TypingActions;
  getReceiptActions: () => ReceiptActions;
};

/** Owns the adapter's real-time subscription and stale-event fence. */
export function useChatAdapterSubscription(options: ChatAdapterSubscriptionOptions): void {
  $effect(() => {
    const resolvedAdapter = options.getAdapter();
    if (!resolvedAdapter?.subscribe) return undefined;

    const currentConversationId = options.getConversationId();
    let active = true;
    const handlers: ChatPushHandlers = {
      onMessage: (message) => {
        if (active) untrack(() => options.getOnMessage())?.(message);
      },
      onTypingChange: (participants) => {
        if (!active) return;
        options.getTypingActions().handleAdapterTypingChange(participants);
        untrack(() => options.getOnTypingChange())?.(participants);
      },
      onReadReceipt: (event) => {
        if (!active) return;
        options.getReceiptActions().handleAdapterReadReceipt(event);
        untrack(() => options.getOnReadReceipt())?.(event);
      },
      onStreamBegin: (messageId) => {
        if (active) options.getStreamingActions().beginStreaming(messageId);
      },
      onTokenPush: (token) => {
        if (active) options.getStreamingActions().pushToken(token);
      },
      onStreamEnd: () => {
        if (active) options.getStreamingActions().endStreaming();
      },
    };

    const unsubscribe = resolvedAdapter.subscribe(currentConversationId, handlers);

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
      options.getStreamingActions().endStreaming();
      options.getTypingActions().reset();
      options.getReceiptActions().reset();
    };
  });
}
