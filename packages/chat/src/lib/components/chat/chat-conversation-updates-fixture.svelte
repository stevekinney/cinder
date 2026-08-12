<script lang="ts">
  import type { ConversationHistory } from './conversation-model.ts';
  import Chat from './chat.svelte';

  let { initial }: { initial: ConversationHistory } = $props();

  // Seeding from `initial` once is the intent: after mount this fixture owns the
  // conversation, and `setConversation` is the only thing that changes it.
  // svelte-ignore state_referenced_locally
  let conversation = $state<ConversationHistory>(initial);

  /**
   * Drive the update the way an app does: a parent that owns the conversation
   * in `$state` and reassigns it. Testing-library's `rerender` sets props
   * directly, which is a different path — the bug this file pins reproduces
   * through both, and the parent is the one that matches real usage.
   */
  export function setConversation(next: ConversationHistory): void {
    conversation = next;
  }
</script>

<Chat id="conversation-updates-chat" {conversation} />
