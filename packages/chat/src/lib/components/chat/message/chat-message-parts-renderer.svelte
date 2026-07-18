<script lang="ts">
  import {
    toRenderUnits,
    type BodyMessagePart,
    type ChatMessagePartsRendererProps,
  } from './chat-message-parts.ts';
  import MarkdownPart from './parts/markdown-part.svelte';
  import ToolCallPart from './parts/tool-call-part.svelte';
  import ToolResultPart from './parts/tool-result-part.svelte';
  import ToolApprovalPart from './parts/tool-approval-part.svelte';
  import ReasoningPart from './parts/reasoning-part.svelte';
  import StepPart from './parts/step-part.svelte';
  import SuggestionPart from './parts/suggestion-part.svelte';
  import ImagePart from './parts/image-part.svelte';

  let {
    parts,
    messagePart,
    expanded = false,
    ontoggle,
    onapprove,
    ondeny,
    reasoningExpanded = false,
    onreasoning,
    onsuggestionselect,
  }: ChatMessagePartsRendererProps = $props();

  const units = $derived(toRenderUnits(parts));

  // APG toolbar roving-tabindex for suggestion chips. `activeIndex` tracks the
  // chip that holds tabindex=0. ArrowRight/ArrowLeft move focus (wrapping);
  // Home/End jump to first/last. Tab and all other keys pass through.
  let activeIndex = $state(0);

  // The chip count can shrink between renders (a new assistant turn with fewer
  // suggestions, or streaming). A raw `activeIndex` left beyond a toolbar's range
  // would leave NO chip with tabindex=0, making that toolbar unreachable by Tab.
  // Clamp against EACH toolbar's own length (not the total across units) so every
  // rendered toolbar always has exactly one tabindex=0 entry point — floored at 0
  // for the empty case.
  function activeChipIndex(count: number): number {
    return count === 0 ? 0 : Math.min(activeIndex, count - 1);
  }

  function handleToolbarKeydown(event: KeyboardEvent, toolbar: HTMLElement, count: number): void {
    if (count === 0) return;
    const current = Math.min(activeIndex, count - 1);
    let next = current;
    if (event.key === 'ArrowRight') {
      next = (current + 1) % count;
    } else if (event.key === 'ArrowLeft') {
      next = (current - 1 + count) % count;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = count - 1;
    } else {
      return;
    }
    event.preventDefault();
    activeIndex = next;
    const chips = toolbar.querySelectorAll<HTMLElement>('[data-cinder-suggestion]');
    chips[next]?.focus();
  }
</script>

<!--
  Built-in renderer for a single body part. A static `{#if part.type === ...}`
  switch (not a dynamic component map) so the bundler can tree-shake unused part
  components and TypeScript narrows each branch. Image parts and step parts never
  reach here — they render through the grouped `{#each}` path below. The trailing
  `{:else}` is the exhaustiveness sentinel: `part.type` narrows to `never` there,
  so a later Chat task that widens ChatMessagePart without adding a branch surfaces
  a visible dev marker in the DOM rather than silently rendering nothing.
-->
{#snippet renderDefault(part: BodyMessagePart)}
  {#if part.type === 'markdown'}
    <MarkdownPart {part} />
  {:else if part.type === 'tool-call'}
    <ToolCallPart {part} {expanded} {ontoggle} />
  {:else if part.type === 'tool-result'}
    <ToolResultPart {part} />
  {:else if part.type === 'tool-approval'}
    <ToolApprovalPart {part} {onapprove} {ondeny} />
  {:else if part.type === 'reasoning'}
    <ReasoningPart {part} expanded={reasoningExpanded} ontoggle={onreasoning} />
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
  {:else if unit.kind === 'steps'}
    <!-- Step parts are grouped and wrapped in a single <ol> stepper. -->
    <ol class="chat-step-list" aria-label="Steps">
      {#each unit.steps as step (step.key)}
        <StepPart part={step} />
      {/each}
    </ol>
  {:else if unit.kind === 'suggestions'}
    <!-- Suggestion chips are grouped into a single toolbar. APG toolbar pattern:
         Tab enters → active chip (tabindex=0); Left/Right arrows move focus
         within (roving tabindex); Tab exits. Home/End jump to first/last.
         [data-cinder-suggested-replies] is the selector used by useChatKeyboardNav
         to suppress message ArrowUp/ArrowDown while focus is inside here. -->
    <div
      class="chat-suggestions"
      role="toolbar"
      tabindex="-1"
      aria-label="Suggested replies"
      data-cinder-suggested-replies
      onkeydown={(event) => {
        handleToolbarKeydown(event, event.currentTarget as HTMLElement, unit.suggestions.length);
      }}
    >
      {#each unit.suggestions as suggestion, index (suggestion.key)}
        <SuggestionPart
          part={suggestion}
          {onsuggestionselect}
          tabindex={index === activeChipIndex(unit.suggestions.length) ? 0 : -1}
        />
      {/each}
    </div>
  {:else if messagePart}
    {@render messagePart(unit.part, renderDefault)}
  {:else}
    {@render renderDefault(unit.part)}
  {/if}
{/each}

<style>
  .chat-step-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .chat-suggestions {
    /* No padding-block-start: the parent .chat-message-body flex column now
       supplies inter-part gap, so an own top padding here would double it. */
    display: flex;
    flex-wrap: wrap;
    gap: var(--cinder-space-2);
  }
</style>
