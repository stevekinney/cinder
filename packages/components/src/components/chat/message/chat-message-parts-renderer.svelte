<script lang="ts">
  import type { ChatMessagePart } from '../utilities/types.ts';
  import { toRenderUnits, type ChatMessagePartsRendererProps } from './chat-message-parts.ts';
  import TextPart from './parts/text-part.svelte';
  import MarkdownPart from './parts/markdown-part.svelte';
  import ToolCallPart from './parts/tool-call-part.svelte';
  import ToolResultPart from './parts/tool-result-part.svelte';
  import ImagePart from './parts/image-part.svelte';

  let { parts, messagePart, expanded = false, ontoggle }: ChatMessagePartsRendererProps = $props();

  const units = $derived(toRenderUnits(parts));
</script>

<!--
  Built-in renderer for a single part. A static `{#if part.type === ...}` switch
  (not a dynamic component map) so the bundler can tree-shake unused part
  components and TypeScript narrows each branch. The trailing `{:else}` asserts
  exhaustiveness: when a later Chat task widens ChatMessagePart, the missing
  case surfaces as a visible fallback here AND a type error at the part level.
-->
{#snippet renderDefault(part: ChatMessagePart)}
  {#if part.type === 'text'}
    <TextPart {part} />
  {:else if part.type === 'markdown'}
    <MarkdownPart {part} />
  {:else if part.type === 'tool-call'}
    <ToolCallPart {part} {expanded} {ontoggle} />
  {:else if part.type === 'tool-result'}
    <ToolResultPart {part} />
  {:else if part.type === 'image'}
    <!-- Single image fallback. The grouped default path (below) is the normal
         route; this branch only fires if an image part is rendered individually
         (e.g. a consumer calls renderDefault on one). -->
    <ImagePart parts={[part]} />
  {/if}
{/snippet}

{#each units as unit (unit.key)}
  {#if unit.kind === 'images'}
    <ImagePart parts={unit.images} />
  {:else if messagePart}
    {@render messagePart(unit.part, renderDefault)}
  {:else}
    {@render renderDefault(unit.part)}
  {/if}
{/each}
