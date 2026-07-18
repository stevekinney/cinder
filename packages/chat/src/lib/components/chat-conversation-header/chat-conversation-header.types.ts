import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ConversationSummary } from '../chat-conversation-list/conversation-summary.ts';
import type { ConversationHistory } from '../chat/conversation-model.ts';

export type ChatConversationHeaderHeadingLevel = 2 | 3 | 4;

/** Props for the ChatConversationHeader component. */
export type ChatConversationHeaderProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Active compatible conversation snapshot. */
  conversation: ConversationHistory;
  /** Heading level for the conversation title. Default `2`. */
  headingLevel?: ChatConversationHeaderHeadingLevel;
  /** Whether to render the built-in conversation export actions. Default `true`. */
  showExportActions?: boolean;
  /** Additional class name merged with `.cinder-chat-conversation-header`. */
  class?: string;
  /** Additional action controls rendered after the built-in export actions. */
  actions?: Snippet<[ConversationSummary]>;
};
