import type {
  ConversationHistory,
  ConversationStatus,
  Message,
} from '../chat/conversation-model.ts';
import { getMessageText } from '../chat/utilities';
import { getMessages } from '../chat/utilities/conversation.ts';

export type ConversationSummary = {
  /** Conversation identifier. */
  id: string;
  /** Human-readable conversation title. */
  title: string;
  /** Compatible conversation lifecycle status. */
  status: ConversationStatus;
  /** Number of visible transcript messages. */
  messageCount: number;
  /** Optional unread count derived from namespaced conversation metadata. */
  unreadCount: number;
  /** ISO timestamp used for sorting and recency display. */
  updatedAt: string;
  /** ISO timestamp for the conversation creation time. */
  createdAt: string;
  /** Last visible message id, when present. */
  lastMessageId?: string;
  /** Last visible message role, when present. */
  lastMessageRole?: Message['role'];
  /** Text preview for the last visible message. */
  lastMessageText?: string;
  /** Created timestamp for the last visible message. */
  lastMessageAt?: string;
  /** Optional participant names derived from namespaced conversation metadata. */
  participantNames: readonly string[];
};

function metadataNumber(metadata: Readonly<Record<string, unknown>>, key: string): number {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function metadataStringArray(
  metadata: Readonly<Record<string, unknown>>,
  key: string,
): readonly string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function fallbackTitle(message: Message | undefined): string {
  if (!message) return 'Untitled conversation';

  const text = getMessageText(message).trim().replace(/\s+/g, ' ');
  if (text.length === 0) return 'Untitled conversation';
  return text.length > 64 ? `${text.slice(0, 61)}...` : text;
}

/** Derives a list/header summary from a compatible ConversationHistory snapshot. */
export function deriveConversationSummary(conversation: ConversationHistory): ConversationSummary {
  const messages = getMessages(conversation);
  const lastMessage = messages.at(-1);
  const title = conversation.title?.trim() || fallbackTitle(lastMessage);

  return {
    id: conversation.id,
    title,
    status: conversation.status,
    messageCount: messages.length,
    unreadCount: metadataNumber(conversation.metadata, '_unreadCount'),
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
    participantNames: metadataStringArray(conversation.metadata, '_participantNames'),
    ...(lastMessage
      ? {
          lastMessageId: lastMessage.id,
          lastMessageRole: lastMessage.role,
          lastMessageText: getMessageText(lastMessage),
          lastMessageAt: lastMessage.createdAt,
        }
      : {}),
  };
}

export function conversationSummaryTimestamp(summary: ConversationSummary): number {
  const timestamp = summary.lastMessageAt ?? summary.updatedAt ?? summary.createdAt;
  const time = Date.parse(timestamp);
  return Number.isNaN(time) ? 0 : time;
}
