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
    <section style="margin: 1rem 0 0;" aria-label="Submitted comments">
      <h4
        style="margin: 0 0 0.5rem; font-size: var(--cinder-text-xs); color: var(--cinder-text-muted); text-transform: uppercase; letter-spacing: 0.04em;"
      >
        Submitted comments
      </h4>
      {#each comments as comment, i (i)}
        <article
          style="padding: 0.5rem 0.75rem; border: 1px solid var(--cinder-border-muted); border-radius: 0.375rem; margin-bottom: 0.375rem; background: var(--cinder-surface);"
        >
          {comment}
        </article>
      {/each}
    </section>
  {/if}
</div>
