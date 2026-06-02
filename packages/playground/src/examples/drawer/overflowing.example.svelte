<script lang="ts" module>
  export const title = 'Overflowing drawer';
  export const description = 'A side drawer with a scrollable body.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { Checkbox } from 'cinder/checkbox';
  import { Drawer } from 'cinder/drawer';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);

  const filters = Array.from({ length: 30 }, (_, index) => ({
    id: `filter-${index + 1}`,
    label: `Filter group ${index + 1}`,
  }));
</script>

<Button
  label="Open drawer"
  onclick={(event) => {
    triggerRef = event.currentTarget as HTMLElement;
    open = true;
  }}
/>

<Drawer bind:open title="Filters" {triggerRef}>
  <div style="display: grid; gap: 0.75rem;">
    {#each filters as filter (filter.id)}
      <Checkbox id={filter.id} label={filter.label} />
    {/each}
  </div>

  {#snippet footer()}
    <Button variant="secondary" label="Cancel" onclick={() => (open = false)} />
    <Button label="Apply" onclick={() => (open = false)} />
  {/snippet}
</Drawer>
