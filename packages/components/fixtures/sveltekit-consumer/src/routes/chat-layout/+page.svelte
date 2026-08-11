<script lang="ts">
  import { onMount } from 'svelte';

  import '../../app.css';
  import Chat, { createConversation, type ConversationHistory } from '@lostgradient/chat';

  let conversation = $state<ConversationHistory>(
    createConversation({ id: 'consumer-chat-layout' }),
  );
  let hydrated = $state(false);

  onMount(() => {
    hydrated = true;
  });
</script>

<h1>Empty Chat hydration</h1>
<main class="chat-layout-fixture" data-chat-layout-hydrated={hydrated}>
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
