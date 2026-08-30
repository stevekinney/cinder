<script lang="ts" module>
  export const title = 'Transcript navigation rail';
  export const description = 'Scrub or tab between user-authored turns in a longer conversation.';
</script>

<script lang="ts">
  import {
    appendAssistantMessage,
    appendUserMessage,
    createConversation,
    getMessages,
  } from '@lostgradient/chat';
  import { ChatNavigationRail } from '@lostgradient/chat/navigation-rail';

  let conversation = createConversation({ id: 'navigation-example' });
  conversation = appendUserMessage(conversation, 'Summarize the launch plan.');
  conversation = appendAssistantMessage(conversation, 'The launch has three phases.');
  conversation = appendUserMessage(conversation, 'What is the riskiest phase?');
  conversation = appendAssistantMessage(
    conversation,
    'The staged rollout needs the closest watch.',
  );
</script>

<div style="height: 16rem; display: flex; justify-content: flex-end;">
  <ChatNavigationRail messages={getMessages(conversation)} />
</div>
