<script lang="ts" module>
  export const title = 'History prepend stress';
  export const description =
    'Adapter-driven load-earlier in a full-height app shell whose header content grows when a load completes — the geometry that stressed history-prepend anchor restoration in #1237.';
</script>

<script lang="ts">
  import {
    Chat,
    appendMessages,
    createConversation,
    prependMessages,
    type ChatAdapter,
    type ConversationHistory,
    type MessageRole,
  } from '@lostgradient/chat';
  import { Button } from '@lostgradient/cinder/button';

  type ArchivedMessageInput = { role: MessageRole; content: string };

  const SEED_COUNT = 60;
  const PAGE_SIZE = 4;
  const TOTAL_PAGES = 3;

  function buildHistoryPages(): ArchivedMessageInput[][] {
    const pages: ArchivedMessageInput[][] = [];
    for (let page = 0; page < TOTAL_PAGES; page += 1) {
      const messages: ArchivedMessageInput[] = [];
      for (let index = 0; index < PAGE_SIZE; index += 1) {
        const globalIndex = page * PAGE_SIZE + index;
        messages.push({
          role: globalIndex % 2 === 0 ? 'user' : 'assistant',
          content: `Archived message ${globalIndex + 1}`,
        });
      }
      pages.push(messages);
    }
    return pages;
  }

  function seedConversation(): ConversationHistory {
    const seedInputs: ArchivedMessageInput[] = [];
    for (let index = 0; index < SEED_COUNT; index += 1) {
      seedInputs.push({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Live message ${index + 1} — enough padding text to give each row real height so the transcript reliably overflows the viewport and scrolling has somewhere to go.`,
      });
    }
    return appendMessages(createConversation({ id: 'history-prepend-stress' }), ...seedInputs);
  }

  let chat: ReturnType<typeof Chat> | undefined;
  let pagesQueue = $state<ArchivedMessageInput[][]>(buildHistoryPages());
  let moreHistoryAvailable = $state(true);
  let conversation = $state<ConversationHistory>(seedConversation());
  let eventLog = $state<string[]>([]);
  let atBottom = $state(true);

  function pushLog(entry: string): void {
    eventLog = [...eventLog, entry].slice(-6);
  }

  const adapter: ChatAdapter = {
    sendMessage: async (message) => {
      conversation = appendMessages(conversation, message);
    },
    loadOlderMessages: async () => {
      const nextPage = pagesQueue.at(0);
      if (!nextPage) {
        pushLog('no pages remain');
        return { hasMore: false };
      }
      conversation = prependMessages(conversation, ...nextPage);
      pagesQueue = pagesQueue.slice(1);
      const hasMore = pagesQueue.length > 0;
      moreHistoryAvailable = hasMore;
      pushLog(`loaded a page, hasMore=${hasMore}`);
      return { hasMore };
    },
  };
</script>

<div
  style="display: flex; flex-direction: column; gap: 0.5rem; height: 100dvh; max-height: 40rem; border: 1px solid var(--cinder-border-muted);"
>
  <div style="padding: 0.5rem 1rem; display: flex; gap: 0.75rem; align-items: center;">
    <Button
      data-testid="stress-scroll-top"
      size="sm"
      variant="secondary"
      onclick={() => chat?.scrollToTop()}
    >
      Scroll to top
    </Button>
    <Button
      data-testid="stress-scroll-bottom"
      size="sm"
      variant="secondary"
      onclick={() => chat?.scrollToBottom()}
    >
      Scroll to bottom
    </Button>
    <span data-testid="stress-at-bottom">atBottom: {atBottom}</span>
    <span data-testid="stress-message-count">messages: {conversation.ids.length}</span>
  </div>

  <ul
    style="margin: 0; padding: 0 1rem; list-style: none; font-size: 0.8rem;"
    data-testid="stress-event-log"
  >
    {#each eventLog as entry, index (index)}
      <li>{entry}</li>
    {/each}
  </ul>

  <div style="flex: 1; min-height: 0;">
    <Chat
      bind:this={chat}
      id="history-prepend-stress-chat"
      {conversation}
      {adapter}
      bind:atBottom
      {moreHistoryAvailable}
    />
  </div>
</div>
