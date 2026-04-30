<script lang="ts" module>
  export const title = 'Basic selection popover';
  export const description = 'A positioned comment action that expands into a composer.';
</script>

<script lang="ts">
  import { SelectionPopover } from '../../../../components/src/index.ts';

  let comments = $state<string[]>([]);
</script>

<div style="position: relative; min-height: 9rem;">
  <p style="max-width: 36rem; margin: 0;">
    Select text in a review editor and this control can appear near the selection. The playground
    keeps it pinned here so the interaction is easy to inspect.
  </p>

  <SelectionPopover
    id="playground-selection-popover"
    open
    position={{ x: 180, y: 96 }}
    oncommentsubmit={(body) => (comments = [...comments, body])}
  />

  {#if comments.length > 0}
    <ul style="margin: 1rem 0 0; padding-left: 1.25rem;">
      {#each comments as comment}
        <li>{comment}</li>
      {/each}
    </ul>
  {/if}
</div>
