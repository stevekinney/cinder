<script lang="ts">
  import {
    toRenderUnits,
    type BodyMessagePart,
    type ChatMessagePartsRendererProps,
  } from './chat-message-parts.ts';
  import MarkdownPart from './parts/markdown-part.svelte';
  import ToolCallPart from './parts/tool-call-part.svelte';
  import ToolResultPart from './parts/tool-result-part.svelte';
  import ImagePart from './parts/image-part.svelte';

  let { parts, messagePart, expanded = false, ontoggle }: ChatMessagePartsRendererProps = $props();

  const units = $derived(toRenderUnits(parts));
</script>

<!--
  Built-in renderer for a single body part. A static `{#if part.type === ...}`
  switch (not a dynamic component map) so the bundler can tree-shake unused part
  components and TypeScript narrows each branch. Image parts never reach here —
  they render through the grouped `{#each}` path below so the attachment grid
  lays out by total count. The trailing `{:else}` is the exhaustiveness sentinel:
  `part.type` narrows to `never` there, so a later Chat task that widens
  ChatMessagePart without adding a branch surfaces a visible dev marker in the
  DOM rather than silently rendering nothing.
-->
{#snippet renderDefault(part: BodyMessagePart)}
  {#if part.type === 'markdown'}
    <MarkdownPart {part} />
  {:else if part.type === 'tool-call'}
    <ToolCallPart {part} {expanded} {ontoggle} />
  {:else if part.type === 'tool-result'}
    <ToolResultPart {part} />
  {:else}
    <!-- Unhandled part type — a new ChatMessagePart variant was added without a
         renderer branch. `part` narrows to `never` here, so svelte-check flags
         the unreachable branch when the union widens, and this sentinel makes
         the omission visible in the DOM. -->
    <span data-cinder-unhandled-part aria-hidden="true"></span>
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
