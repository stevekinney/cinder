<script lang="ts">
  import Chat, { createConversation, type ConversationHistory } from '@lostgradient/chat';
  import '../../app.css';

  let conversation = $state<ConversationHistory>(
    createConversation({ id: 'consumer-chat-layout' }),
  );
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
