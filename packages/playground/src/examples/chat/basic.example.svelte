<script lang="ts" module>
  export const title = 'Basic chat';
  export const description = 'A conversation with editable input and markdown rendering.';
</script>

<script lang="ts">
  import {
    Chat,
    type ChatSubmitEvent,
    appendAssistantMessage,
    appendUserMessage,
    createConversation,
  } from '@lostgradient/chat';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let chatId = $derived(`${mountIdPrefix ?? uid}-chat`);

  // `id` below is the conversation snapshot's data key — it never reaches a DOM
  // element id (Chat derives every rendered id from its `id` prop, scoped above
  // as `chatId`), so it needs no mount-prefix scoping.
  let conversation = $state(
    appendAssistantMessage(
      appendUserMessage(createConversation({ id: 'basic-chat' }), 'Can you summarize this plan?'),
      `The plan is ready to implement.

1. Port the component surface.
2. Add focused demos.
3. Keep the public API importable by subpath.`,
    ),
  );

  function handleSubmit(event: ChatSubmitEvent): void {
    conversation = appendUserMessage(conversation, event.message.content);
  }
</script>

<div style="height: 34rem;">
  <Chat id={chatId} {conversation} capabilities={{ attachments: false }} onsubmit={handleSubmit} />
</div>
