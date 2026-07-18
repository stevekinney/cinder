<script lang="ts" module>
  export const title = 'Streaming chat';
  export const description = 'Streaming status keeps the composer in stop mode.';
</script>

<script lang="ts">
  import {
    Chat,
    appendAssistantMessage,
    appendUserMessage,
    createConversation,
  } from '@lostgradient/chat';

  let conversation = $state(
    appendAssistantMessage(
      appendUserMessage(
        createConversation({ id: 'streaming-chat' }),
        'What is happening in the current run?',
      ),
      'The assistant is applying the port, checking compiler feedback, and updating the demos as each component lands.',
    ),
  );
</script>

<div style="height: 34rem;">
  <Chat
    id="playground-streaming-chat"
    {conversation}
    streaming
    streamingStatus="Writing response..."
    capabilities={{ attachments: false }}
  />
</div>
