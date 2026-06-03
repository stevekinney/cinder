import type { Snippet } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';

import type {
  ChatScrollStateChangeEvent,
  ChatStopGeneratingEvent,
  ChatSubmitEvent,
  ChatUnreadIndicatorChangeEvent,
} from './container/chat-events.ts';
import type { ConversationHistory, Message } from './conversation-model.ts';
import type { ChatAttachment } from './input/chat-attachment.ts';

/** Props for the Chat component. */
// `onsubmit` is redefined below with a ChatSubmitEvent payload, so strip the
// native DOM SubmitEvent handler from the base attributes to avoid an
// intersection that no handler can satisfy.
export type ChatProps = Omit<HTMLAttributes<HTMLElement>, 'class' | 'onsubmit'> & {
  id: string;
  /**
   * The conversation transcript to render. Pass a {@link ConversationHistory}
   * snapshot; consumers holding a stateful conversation object pass its current
   * snapshot (e.g. `conversation.current`).
   */
  conversation: ConversationHistory;
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
