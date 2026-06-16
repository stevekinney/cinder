<script lang="ts" module>
  import type { MarkdownMessagePart } from '../../utilities/types.ts';

  export type MarkdownPartProps = {
    /** The markdown render part to display. */
    part: MarkdownMessagePart;
  };
</script>

<script lang="ts">
  import MessageContent from '../message-content.svelte';

  let { part }: MarkdownPartProps = $props();
</script>

<!--
  The body text of a message, rendered through the markdown pipeline. `content`
  is already the effective text (streaming override resolved in by
  `deriveMessageParts`), so this part forwards it straight to MessageContent —
  no `overrideContent` plumbing leaks into the part layer. Streaming and
  expanded are presentation hints carried on the part.
-->
<MessageContent content={part.content} streaming={part.streaming} expanded={part.expanded} />
