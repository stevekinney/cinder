<script lang="ts">
  import Chat, { createConversation } from '@lostgradient/chat';

  const conversation = createConversation({ id: 'consumer-chat-layout' });
</script>

<h1>Empty Chat hydration</h1>
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
