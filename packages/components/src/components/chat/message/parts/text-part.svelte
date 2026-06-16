<script lang="ts" module>
  import type { TextMessagePart } from '../../utilities/types.ts';

  export type TextPartProps = {
    /** The text render part to display. */
    part: TextMessagePart;
  };
</script>

<script lang="ts">
  let { part }: TextPartProps = $props();
</script>

<!-- Raw text, shown verbatim with whitespace preserved. No markdown pipeline. -->
<span class="chat-message-text-part">{part.text}</span>

<style>
  .chat-message-text-part {
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
