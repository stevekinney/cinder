<script lang="ts" module>
  export const title = 'Nested session transcript';
  export const description = 'A reduced child conversation rendered inside its parent workflow.';
</script>

<script lang="ts">
  import {
    ChatSubSession,
    appendAssistantMessage,
    appendUserMessage,
    createConversation,
  } from '@lostgradient/chat';

  let conversation = createConversation({ id: 'nested-example' });
  conversation = appendUserMessage(conversation, 'Inspect the deployment logs.');
  conversation = appendAssistantMessage(conversation, 'The deployment completed without errors.');
</script>

<ChatSubSession {conversation} />
