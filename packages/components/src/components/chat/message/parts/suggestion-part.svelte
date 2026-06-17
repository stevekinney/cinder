<script lang="ts" module>
  import type { SuggestionMessagePart } from '../../utilities/types.ts';

  export type SuggestionPartProps = {
    /** The suggestion render part to display. */
    part: SuggestionMessagePart;
    /** Called when the user selects this suggestion chip. */
    onsuggestionselect?: ((label: string) => void) | undefined;
    /**
     * Roving tabindex for APG toolbar keyboard navigation. The toolbar parent
     * sets `tabindex=0` on the active chip and `tabindex=-1` on all others so
     * Tab enters the toolbar at the active chip, then arrow keys move focus
     * within it. Defaults to `0` (all chips tabbable) when the toolbar does not
     * manage roving tabindex.
     */
    tabindex?: 0 | -1;
  };
</script>

<script lang="ts">
  let { part, onsuggestionselect, tabindex = 0 }: SuggestionPartProps = $props();

  function handleClick(): void {
    onsuggestionselect?.(part.label);
  }
</script>

<!--
  A single suggested-reply chip. Rendered as a <button type="button"> so it
  activates on both Enter and Space (native button behaviour). The chip is
  part of a `role="toolbar"` container rendered by the parent — individual
  chips do not carry their own toolbar role. The `tabindex` prop enables APG
  toolbar roving-tabindex: the parent sets 0 on the active chip and -1 on the
  rest so Tab enters at the active chip, arrow keys move within the toolbar.
-->
<button
  type="button"
  class="chat-suggestion-chip"
  data-cinder-suggestion
  {tabindex}
  onclick={handleClick}
>
  {part.label}
</button>

<style>
  .chat-suggestion-chip {
    --cinder-chat-suggestion-bg: var(--cinder-surface-raised);
    --cinder-chat-suggestion-border: var(--cinder-border);
    --cinder-chat-suggestion-text: var(--cinder-text);
    --cinder-chat-suggestion-bg-hover: var(--cinder-surface-hover);

    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-block-size: var(--cinder-touch-target-min, 2.75rem);
    /* WCAG 2.5.5 applies to both axes — a single-character suggestion would
       otherwise produce a chip narrower than the 44px target. */
    min-inline-size: var(--cinder-touch-target-min, 2.75rem);
    padding-block: var(--cinder-space-2);
    padding-inline: var(--cinder-space-4);
    background: var(--cinder-chat-suggestion-bg);
    border: 1px solid var(--cinder-chat-suggestion-border);
    border-radius: var(--cinder-radius-full, 9999px);
    color: var(--cinder-chat-suggestion-text);
    font-size: var(--cinder-text-sm);
    line-height: 1.25;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-inline-size: 24rem;
    transition: background-color var(--cinder-duration-fast) var(--cinder-ease-standard);

    /* Focus-visible ring — not just :focus so mouse users don't see the ring. */
    &:focus-visible {
      outline: var(--cinder-ring-width) solid transparent;
      outline-offset: 2px;
      box-shadow: var(--_cinder-focus-ring-shadow);
    }

    /* Hover only on pointer devices to avoid sticky hover on touch. */
    @media (hover: hover) {
      &:hover {
        background: var(--cinder-chat-suggestion-bg-hover);
        border-color: var(--cinder-accent, var(--cinder-chat-suggestion-border));
      }
    }
  }
</style>
