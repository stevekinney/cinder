<script lang="ts" module>
  export const title = 'Reverse (chat transcript)';
  export const description =
    'A transcript that opens at its newest message and returns there whenever one arrives, however far the reader has scrolled back. Items stay in natural order — reverse names the anchoring, not the ordering. Prepending older history leaves the reader exactly where they were.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { VirtualList } from '@lostgradient/cinder/virtual-list';

  type Message = {
    id: string;
    author: string;
    body: string;
  };

  const authors = ['ada', 'grace', 'alan', 'katherine', 'barbara'];

  let nextId = $state(400);
  let oldestId = $state(0);

  let messages = $state<Message[]>(
    Array.from({ length: 400 }, (_, index) => ({
      id: `message-${index}`,
      author: authors[index % authors.length] ?? 'ada',
      body: `Message ${index}. ${'This line repeats to give the row some height. '.repeat((index % 3) + 1)}`,
    })),
  );

  function appendMessage() {
    const index = nextId;
    nextId += 1;
    messages = [
      ...messages,
      {
        id: `message-${index}`,
        author: authors[index % authors.length] ?? 'ada',
        body: `Message ${index}. Just arrived — the transcript returns to the newest row.`,
      },
    ];
  }

  function prependHistory() {
    const older = Array.from({ length: 20 }, (_, offset) => {
      const index = oldestId - 20 + offset;
      return {
        id: `message-${index}`,
        author: authors[((index % authors.length) + authors.length) % authors.length] ?? 'ada',
        body: `Message ${index}. Older history, loaded above without moving the reader.`,
      };
    });
    oldestId -= 20;
    messages = [...older, ...messages];
  }
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem;">
  <div style="display: flex; gap: 0.5rem;">
    <Button variant="secondary" onclick={prependHistory}>Load older history</Button>
    <Button onclick={appendMessage}>New message</Button>
  </div>

  <VirtualList
    items={messages}
    itemHeight={64}
    dynamicSize
    reverse
    height="320px"
    getKey={(message) => message.id}
    aria-label="Chat transcript"
  >
    {#snippet row(message, context)}
      <div
        style="display: flex; gap: 0.75rem; padding: 0.5rem 0.75rem; border-block-end: 1px solid var(--cinder-border);"
        data-index={context.index}
      >
        <strong style="min-inline-size: 6rem;">{message.author}</strong>
        <span>{message.body}</span>
      </div>
    {/snippet}
  </VirtualList>
</div>
