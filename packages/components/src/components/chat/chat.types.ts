import type { Conversation, Message } from 'conversationalist';
import type { Snippet } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';

import type {
  ChatScrollStateChangeEvent,
  ChatStopGeneratingEvent,
  ChatSubmitEvent,
  ChatUnreadIndicatorChangeEvent,
} from './container/chat-events.ts';
import type { ChatAttachment } from './input/chat-attachment.ts';

/** Props for the Chat component. */
export type ChatProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  id: string;
  conversation: Conversation;
  isAtBottom?: boolean;
  unreadCount?: number;
  hasNewMessageIndicator?: boolean;
  class?: string;
  surfaceMode?: 'default' | 'transparent';
  bottomThreshold?: number;
  jumpThreshold?: number;
  isStreaming?: boolean;
  streamingStatus?: string;
  allowAttachments?: boolean;
  allowSearch?: boolean;
  allowCopy?: boolean;
  allowEditing?: boolean;
  allowRetry?: boolean;
  header?: Snippet;
  empty?: Snippet;
  emptyPrompts?: string[];
  messageActions?: Snippet<[Message]>;
  messageStatus?: Snippet<[Message]>;
  viewportAttachment?: Attachment<HTMLElement>;
  onsubmit?: (event: ChatSubmitEvent) => void;
  onretry?: (messageId: string) => void;
  onedit?: (event: { messageId: string; content: string }) => void;
  onstopgenerating?: (event: ChatStopGeneratingEvent) => void;
  onjumptolatest?: () => void;
  onscrollstatechange?: (event: ChatScrollStateChangeEvent) => void;
  onunreadindicatorchange?: (event: ChatUnreadIndicatorChangeEvent) => void;
  onexpandedchange?: (expanded: boolean) => void;
  onattachmentadd?: (attachment: ChatAttachment) => void;
  onattachmentremove?: (attachment: ChatAttachment) => void;
  onattachmentfailure?: (file: File, error: string) => void;
};
