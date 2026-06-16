<script lang="ts" module>
  import type { ChatAdapter } from './chat-adapter.ts';
  import type { ConversationHistory } from '../conversation-model.ts';

  export type AdapterSwitchFixtureProps = {
    initial: ConversationHistory;
    adapter: ChatAdapter;
  };
</script>

<script lang="ts">
  import Chat from '../chat.svelte';

  let { initial, adapter }: AdapterSwitchFixtureProps = $props();

  // Real $state so the test can switch the conversation snapshot and exercise
  // the subscribe `$effect`'s re-subscription on `conversation.id` change.
  let conversation = $state<ConversationHistory>(initial);

  export function setConversation(next: ConversationHistory): void {
    conversation = next;
  }
</script>

<div style="height: 20rem;">
  <Chat id="switch-chat" {conversation} {adapter} />
</div>
