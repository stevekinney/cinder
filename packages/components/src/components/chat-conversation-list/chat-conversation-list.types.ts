import type { HTMLAttributes } from 'svelte/elements';
import type { ConversationSummary } from './conversation-summary.ts';

/** Props for the ChatConversationList component. */
export type ChatConversationListProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Conversation summaries to render. Sorts by latest message/update time descending. */
  conversations: readonly ConversationSummary[];
  /** Currently active conversation id. */
  activeConversationId?: string | null;
  /** Accessible name for the conversations navigation landmark. Default `"Conversations"`. */
  ariaLabel?: string;
  /** Empty state text when no conversations are present. Default `"No conversations"`. */
  emptyText?: string;
  /** Additional class name merged with `.cinder-chat-conversation-list`. */
  class?: string;
  /** Called when a conversation is selected. */
  onselectconversation?: (conversationId: string) => void;
};
