<script lang="ts" module>
  import type { ChatMessagePart } from '../utilities/types.ts';

  export type PartsRendererFixtureProps = {
    /** Initial parts; mutate via the exported `setParts`. */
    initialParts: ChatMessagePart[];
  };
</script>

<script lang="ts">
  import ChatMessagePartsRenderer from './chat-message-parts-renderer.svelte';

  let { initialParts }: PartsRendererFixtureProps = $props();

  // Real Svelte $state so the test can drive a reactive update through the
  // renderer (matching how the container re-derives parts during streaming),
  // rather than relying on a props-replacement rerender.
  let parts = $state<ChatMessagePart[]>(initialParts);

  export function setParts(next: ChatMessagePart[]): void {
    parts = next;
  }
</script>

<ChatMessagePartsRenderer {parts} />
