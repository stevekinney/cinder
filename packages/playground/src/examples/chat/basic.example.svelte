<script lang="ts" module>
  export const title = 'Basic chat';
  export const description = 'A conversation with editable input and markdown rendering.';
</script>

<script lang="ts">
  import { Chat } from '../../../../components/src/index.ts';
  import { appendAssistantMessage, appendUserMessage, createConversation } from 'conversationalist';

  let conversation = $state(
    appendAssistantMessage(
      appendUserMessage(createConversation({ id: 'basic-chat' }), 'Can you summarize this plan?'),
      `The plan is ready to implement.

1. Port the component surface.
2. Add focused demos.
3. Keep the public API importable by subpath.`,
    ),
  );
</script>

<div style="height: 34rem;">
  <Chat id="playground-basic-chat" {conversation} allowAttachments={false} />
</div>
