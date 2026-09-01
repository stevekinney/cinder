<script lang="ts" module>
  export const title = 'Variable-height rows with dynamicSize';
  export const description =
    'A 5,000 message transcript whose rows wrap to different heights. itemHeight is only the starting estimate; each row is measured once as it mounts and the scroll position is corrected so the viewport never jumps.';
</script>

<script lang="ts">
  import { VirtualList } from '@lostgradient/cinder/virtual-list';

  type Message = {
    id: string;
    author: string;
    body: string;
  };

  const authors = ['ada', 'grace', 'alan', 'katherine', 'barbara'];

  // Deliberately uneven bodies: a fixed itemHeight cannot describe this list,
  // which is exactly the case dynamicSize exists for.
  const messages: Message[] = Array.from({ length: 5_000 }, (_, index) => ({
    id: `message-${index}`,
    author: authors[index % authors.length] ?? 'ada',
    body: `Message ${index.toLocaleString('en-US')}. ${'This sentence repeats to make the row wrap onto more lines. '.repeat((index % 5) + 1)}`,
  }));
</script>

<VirtualList
  items={messages}
  itemHeight={64}
  dynamicSize
  height="360px"
  getKey={(message) => message.id}
  aria-label="Transcript"
>
  {#snippet row(message, context)}
    <div
      style="display: grid; grid-template-columns: 6rem minmax(0, 1fr); gap: 0.75rem; padding-block: 0.5rem; padding-inline: 0.75rem; border-block-end: 1px solid var(--cinder-border-muted); font-size: var(--cinder-text-sm);"
      data-index={context.index}
    >
      <strong style="color: var(--cinder-text-muted);">{message.author}</strong>
      <p style="margin: 0;">{message.body}</p>
    </div>
  {/snippet}
</VirtualList>
