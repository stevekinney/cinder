<script lang="ts" module>
  import type { ConversationHistory } from './conversation-model.ts';

  export type ChatHistoryPaginationFixtureProps = {
    conversation: ConversationHistory;
    virtualized?: boolean;
    loadHistory: (
      conversation: ConversationHistory,
    ) => ConversationHistory | Promise<ConversationHistory>;
  };
</script>

<script lang="ts">
  import Chat from './chat.svelte';

  let {
    conversation = $bindable(),
    virtualized = false,
    loadHistory,
  }: ChatHistoryPaginationFixtureProps = $props();

  async function handleLoadHistory(): Promise<void> {
    conversation = await loadHistory(conversation);
  }
</script>

<Chat
  id="virtual-chat"
  {conversation}
  {virtualized}
  virtualizationEstimatedRowHeight={20}
  virtualizationInitialHeight={100}
  virtualizationOverscan={0}
  onloadhistory={handleLoadHistory}
/>
