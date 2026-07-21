<script lang="ts" module>
  import type { ConversationHistory } from './conversation-model.ts';

  export type OverrideDelegationFixtureProps = {
    conversation: ConversationHistory;
    /** When true, the row/part overrides delegate to renderDefault; else replace. */
    delegate: boolean;
  };
</script>

<script lang="ts">
  import Chat from './chat.svelte';

  let { conversation, delegate }: OverrideDelegationFixtureProps = $props();
</script>

<div style="height: 20rem;">
  <Chat id="delegation-chat" {conversation}>
    {#snippet row({ message }, renderDefault)}
      <div class="row-wrapper" data-role={message.role}>
        {#if delegate}
          {@render renderDefault()}
        {:else}
          <span class="row-replaced">replaced</span>
        {/if}
      </div>
    {/snippet}
    {#snippet messagePart(part, renderDefault)}
      <div class="part-wrapper" data-part-type={part.type}>
        {#if delegate}
          {@render renderDefault(part)}
        {:else}
          <span class="part-replaced">replaced part</span>
        {/if}
      </div>
    {/snippet}
  </Chat>
</div>
