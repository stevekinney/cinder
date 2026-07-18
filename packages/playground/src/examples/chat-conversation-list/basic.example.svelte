<script lang="ts" module>
  export const title = 'Basic conversation list';
  export const description = 'Conversation summaries with an active conversation and unread count.';
</script>

<script lang="ts">
  import {
    ChatConversationList,
    type ConversationSummary,
  } from '@lostgradient/chat/conversation-list';

  const conversations: ConversationSummary[] = [
    {
      id: 'launch',
      title: 'Launch support',
      status: 'active',
      messageCount: 12,
      unreadCount: 2,
      createdAt: '2026-06-01T08:00:00.000Z',
      updatedAt: '2026-06-01T08:45:00.000Z',
      lastMessageId: 'launch-last',
      lastMessageRole: 'assistant',
      lastMessageText: 'I drafted the launch checklist.',
      lastMessageAt: '2026-06-01T08:45:00.000Z',
      participantNames: ['Ada', 'Grace'],
    },
    {
      id: 'billing',
      title: 'Billing question',
      status: 'active',
      messageCount: 4,
      unreadCount: 0,
      createdAt: '2026-06-01T07:00:00.000Z',
      updatedAt: '2026-06-01T07:20:00.000Z',
      lastMessageId: 'billing-last',
      lastMessageRole: 'user',
      lastMessageText: 'Can you resend the invoice?',
      lastMessageAt: '2026-06-01T07:20:00.000Z',
      participantNames: ['Lin'],
    },
  ];
</script>

<ChatConversationList {conversations} activeConversationId="launch" />
