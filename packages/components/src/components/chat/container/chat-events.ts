import type { MessageInput } from '../conversation-model.ts';
import type { ChatAttachment } from '../input/chat-attachment.ts';

/** Event fired when a message is submitted. */
export type ChatSubmitEvent = {
  message: MessageInput;
  attachments: ChatAttachment[];
};

/** Event fired when stop generating is requested. */
export type ChatStopGeneratingEvent = {
  messageId: string;
};

/** Event fired when scroll state changes. */
export type ChatScrollStateChangeEvent = {
  isAtBottom: boolean;
  scrollTop: number;
  scrollHeight: number;
};

/** Event fired when unread indicator state changes. */
export type ChatUnreadIndicatorChangeEvent = {
  unreadCount: number;
  hasNewMessageIndicator: boolean;
};
