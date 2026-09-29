import type { ConversationHistory, Message } from '../conversation-model.ts';
import { useChatTranscript } from './use-chat-transcript.svelte.ts';

export function createTranscriptFixture(conversation: ConversationHistory) {
  let currentConversation = $state(conversation);
  let firstUnreadId = $state<string | null>(null);
  let streaming = $state(false);
  let streamingMessageId = $state<string | null>(null);
  let streamingContent = $state('');
  let ungroupAllToolCalls = $state(false);
  let reasoning = $state<((item: Message) => string | undefined) | undefined>(undefined);
  const transcript = useChatTranscript({
    getConversation: () => currentConversation,
    getRollbackMessageId: () => null,
    getStreaming: () => streaming,
    getStreamingMessageId: () => streamingMessageId,
    getStreamingContent: () => streamingContent,
    getMessageReasoning: () => reasoning,
    getFirstUnreadId: () => firstUnreadId,
    getUngroupAllToolCalls: () => ungroupAllToolCalls,
  });
  return {
    transcript,
    setConversation: (value: ConversationHistory) => (currentConversation = value),
    setFirstUnreadId: (value: string | null) => (firstUnreadId = value),
    setStreaming: (value: boolean) => (streaming = value),
    setStreamingMessageId: (value: string | null) => (streamingMessageId = value),
    setStreamingContent: (value: string) => (streamingContent = value),
    setUngroupAllToolCalls: (value: boolean) => (ungroupAllToolCalls = value),
    setReasoning: (value: ((item: Message) => string | undefined) | undefined) =>
      (reasoning = value),
  };
}
