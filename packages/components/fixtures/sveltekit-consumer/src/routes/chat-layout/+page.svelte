<script lang="ts">
  import Chat, {
    appendAssistantMessage,
    appendUserMessage,
    createConversation,
  } from '@lostgradient/cinder/chat';

  const conversation = (() => {
    let nextConversation = createConversation({ id: 'consumer-chat-layout' });

    for (let index = 0; index < 24; index += 1) {
      nextConversation = appendUserMessage(nextConversation, `Question ${index + 1}`);
      nextConversation = appendAssistantMessage(
        nextConversation,
        `Answer ${index + 1} with enough text to make the transcript taller than the bounded fixture.`,
      );
    }

    return nextConversation;
  })();
</script>

<main class="chat-layout-fixture">
  <Chat id="consumer-chat-layout" {conversation} />
</main>

<style>
  .chat-layout-fixture {
    display: flex;
    flex-direction: column;
    height: 24rem;
    min-height: 0;
    overflow: hidden;
  }
</style>
