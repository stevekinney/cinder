<script lang="ts" module>
  export const title = 'Overflowing sheet';
  export const description = 'A bottom sheet with enough content to scroll.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Sheet } from '@lostgradient/cinder/sheet';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);

  const actions = Array.from({ length: 14 }, (_, index) => ({
    id: `action-${index + 1}`,
    label: `Workspace action ${index + 1}`,
    description: 'Secondary action detail and short explanatory copy.',
  }));
</script>

<Button
  label="Open sheet"
  onclick={(event) => {
    triggerRef = event.currentTarget as HTMLElement;
    open = true;
  }}
/>

<Sheet bind:open title="Workspace actions" {triggerRef} showDragHandle>
  <div style="display: grid; gap: 0.875rem;">
    {#each actions as action (action.id)}
      <section>
        <h3 style="margin: 0 0 0.25rem; font-size: var(--cinder-text-base);">
          {action.label}
        </h3>
        <p style="margin: 0; color: var(--cinder-text-muted);">{action.description}</p>
      </section>
    {/each}
  </div>

  {#snippet footer()}
    <Button label="Done" onclick={() => (open = false)} />
  {/snippet}
</Sheet>
