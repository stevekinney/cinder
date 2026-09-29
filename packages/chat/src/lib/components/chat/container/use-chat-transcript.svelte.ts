import { isStreamingMessage } from '../builders.ts';
import type { ConversationHistory, Message, ToolResult } from '../conversation-model.ts';
import {
  getMessages,
  getMessageText,
  pairToolCallsWithResults,
  resolveMessageReasoning,
} from '../utilities/index.ts';
import type { ReasoningInfo } from '../utilities/types.ts';
import { selectChatProgressState, type ChatProgressState } from './select-chat-progress-state.ts';
import {
  getActiveTurnMessageIds,
  useChatMessageGroups,
  type ChatRenderRow,
} from './use-chat-message-groups.svelte.ts';

export interface UseChatTranscriptOptions {
  getConversation: () => ConversationHistory;
  getRollbackMessageId: () => string | null;
  getStreaming: () => boolean;
  getStreamingMessageId: () => string | null;
  getStreamingContent: () => string;
  getMessageReasoning?:
    (() => ((message: Message) => string | ReasoningInfo | undefined) | undefined) | undefined;
  getFirstUnreadId: () => string | null;
  getUngroupAllToolCalls: () => boolean;
}

export interface UseChatTranscriptReturn {
  readonly messages: Message[];
  readonly lastMessageId: string | undefined;
  readonly messageIndexById: Map<string, number>;
  readonly rollbackBoundaryIndex: number;
  readonly reasoningStreaming: boolean;
  readonly toolActivity: boolean;
  readonly activeTurnMessageIds: Set<string>;
  readonly progressState: ChatProgressState;
  readonly showTypingIndicator: boolean;
  readonly toolCallPairsByCallId: Map<string, import('../conversation-model.ts').ToolCallPair[]>;
  readonly toolResultMessagesByResult: Map<ToolResult, Message>;
  readonly actionRequiredToolCallIds: Set<string>;
  readonly renderRows: ChatRenderRow[];
}

function isStreamingAssistantMessage(message: Message | undefined): message is Message {
  return message?.role === 'assistant' && isStreamingMessage(message);
}

export function useChatTranscript(options: UseChatTranscriptOptions): UseChatTranscriptReturn {
  const messages = $derived(getMessages(options.getConversation()));
  const lastMessageId = $derived(messages.at(-1)?.id);
  const rollbackBoundaryIndex = $derived.by(() => {
    const rollbackMessageId = options.getRollbackMessageId();
    return rollbackMessageId
      ? messages.findIndex((message) => message.id === rollbackMessageId)
      : -1;
  });
  const messageIndexById = $derived(
    new Map(messages.map((message, index) => [message.id, index] as const)),
  );

  const messageGroups = useChatMessageGroups({
    getMessages: () => messages,
    getRenderOptions: () => {
      const renderOptions: {
        firstUnreadId: string | null;
        showTypingIndicator: boolean;
        ungroupedToolCallIds?: ReadonlySet<string>;
      } = {
        firstUnreadId: options.getFirstUnreadId(),
        showTypingIndicator,
      };
      if (options.getUngroupAllToolCalls()) {
        renderOptions.ungroupedToolCallIds = new Set(
          messages.flatMap((message) => (message.toolCall?.id ? [message.toolCall.id] : [])),
        );
      }
      return renderOptions;
    },
  });
  const toolResultMessagesByResult = $derived.by(() => {
    const map = new Map<ToolResult, Message>();
    for (const message of messages) {
      if (message.role === 'tool-result' && message.toolResult) {
        map.set(message.toolResult, message);
      }
    }
    return map;
  });
  const toolCallPairsByCallId = $derived(messageGroups.toolCallPairsByCallId);
  const actionRequiredToolCallIds = $derived(messageGroups.actionRequiredToolCallIds);

  const reasoningStreaming = $derived.by(() => {
    if (!options.getStreaming()) return false;
    const activeMessageId = options.getStreamingMessageId() ?? messages.at(-1)?.id;
    const activeMessage = messages.find((message) => message.id === activeMessageId);
    if (!activeMessage) return false;
    if (options.getStreamingMessageId() === null && !isStreamingMessage(activeMessage)) {
      return false;
    }
    return Boolean(resolveMessageReasoning(activeMessage, options.getMessageReasoning?.()));
  });
  const activeTurnMessageIds = $derived.by(() => {
    if (!options.getStreaming()) return new Set<string>();
    const activeMessageId = options.getStreamingMessageId() ?? messages.at(-1)?.id;
    return getActiveTurnMessageIds(messages, activeMessageId ?? undefined);
  });
  const toolActivity = $derived.by(() => {
    if (!options.getStreaming()) return false;
    return pairToolCallsWithResults(
      messages.filter((message) => activeTurnMessageIds.has(message.id)),
    ).some((pair) => !pair.result);
  });
  const activeStreamingMessage = $derived.by(() => {
    if (!options.getStreaming()) return undefined;
    const streamingMessageId = options.getStreamingMessageId();
    if (streamingMessageId) return messages.find((message) => message.id === streamingMessageId);
    const latestMessage = messages.at(-1);
    return isStreamingAssistantMessage(latestMessage) ? latestMessage : undefined;
  });
  const activeStreamingText = $derived.by(() => {
    if (!options.getStreaming()) return '';
    const streamingMessageId = options.getStreamingMessageId();
    if (streamingMessageId) return options.getStreamingContent();
    return activeStreamingMessage ? getMessageText(activeStreamingMessage) : '';
  });
  const hasActiveStreamingText = $derived(activeStreamingText.trim().length > 0);
  const progressState = $derived(
    selectChatProgressState({
      streaming: options.getStreaming(),
      reasoningStreaming,
      toolActivity,
    }),
  );
  const showTypingIndicator = $derived(progressState === 'streaming' && !hasActiveStreamingText);

  return {
    get messages() {
      return messages;
    },
    get lastMessageId() {
      return lastMessageId;
    },
    get messageIndexById() {
      return messageIndexById;
    },
    get rollbackBoundaryIndex() {
      return rollbackBoundaryIndex;
    },
    get reasoningStreaming() {
      return reasoningStreaming;
    },
    get toolActivity() {
      return toolActivity;
    },
    get activeTurnMessageIds() {
      return activeTurnMessageIds;
    },
    get progressState() {
      return progressState;
    },
    get showTypingIndicator() {
      return showTypingIndicator;
    },
    get toolCallPairsByCallId() {
      return toolCallPairsByCallId;
    },
    get toolResultMessagesByResult() {
      return toolResultMessagesByResult;
    },
    get actionRequiredToolCallIds() {
      return actionRequiredToolCallIds;
    },
    get renderRows() {
      return messageGroups.renderRows;
    },
  };
}
