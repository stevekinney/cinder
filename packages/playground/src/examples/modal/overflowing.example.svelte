<script lang="ts" module>
  export const title = 'Overflowing modal';
  export const description = 'A modal body with enough content to scroll.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Modal } from '@lostgradient/cinder/modal';

  let open = $state(false);
  let longContent = $state(true);
  let triggerRef: HTMLElement | null = $state(null);

  const sections = Array.from({ length: 12 }, (_, index) => ({
    id: `section-${index + 1}`,
    title: `Review section ${index + 1}`,
    body: 'Operational notes, approval context, and supporting detail for the current workflow.',
  }));
</script>

<div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;">
  <Button
    label="Open modal"
    onclick={(event) => {
      triggerRef = event.currentTarget as HTMLElement;
      open = true;
    }}
  />
  <Button
    label={longContent ? 'Use short content' : 'Use long content'}
    variant="secondary"
    onclick={() => (longContent = !longContent)}
  />
</div>

<Modal bind:open title="Release checklist" {triggerRef}>
  {#if longContent}
    <div style="display: grid; gap: 1rem;">
      {#each sections as section (section.id)}
        <section>
          <h3 style="margin: 0 0 0.25rem; font-size: var(--cinder-text-base);">
            {section.title}
          </h3>
          <p style="margin: 0; color: var(--cinder-text-muted);">{section.body}</p>
        </section>
      {/each}
    </div>
  {:else}
    <p style="margin: 0;">This short body should fit without a scroll fade.</p>
  {/if}

  {#snippet footer()}
    <Button label="Close" onclick={() => (open = false)} />
  {/snippet}
</Modal>
