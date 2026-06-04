<script lang="ts" module>
  export const title = 'Tablist variant';
  export const description =
    'The `variant="tablist"` treatment for picker-shaped controls that switch between externally owned panels. Unlike the default radiogroup, the tablist has no enclosing surface and marks the selected tab with an accent underline (horizontal) or inline-start bar (vertical). Each tab wires `aria-controls` to a panel rendered elsewhere in the layout. See docs/decisions/segmented-control-tablist-variant.md.';
</script>

<script lang="ts">
  import { Segment } from '@lostgradient/cinder/segment';
  import { SegmentedControl } from '@lostgradient/cinder/segmented-control';

  type View = 'editor' | 'diff' | 'summary';

  const views: { value: View; label: string; body: string }[] = [
    { value: 'editor', label: 'Editor', body: 'Editor panel — edit the document here.' },
    { value: 'diff', label: 'Diff', body: 'Diff panel — review the changes side by side.' },
    { value: 'summary', label: 'Summary', body: 'Summary panel — the high-level overview.' },
  ];

  let horizontalValue = $state<View>('editor');
  let verticalValue = $state<View>('editor');
</script>

<div style="display: grid; gap: 1.5rem; justify-items: start;">
  <div style="display: grid; gap: 0.75rem; justify-items: start; width: 100%;">
    <SegmentedControl
      id="segmented-tablist-horizontal"
      selectionMode="single"
      variant="tablist"
      bind:value={horizontalValue}
      label="Review view"
    >
      {#each views as view (view.value)}
        <Segment
          id="segmented-tablist-{view.value}-tab"
          value={view.value}
          controls="segmented-tablist-{view.value}-panel"
        >
          {view.label}
        </Segment>
      {/each}
    </SegmentedControl>

    {#each views as view (view.value)}
      <div
        id="segmented-tablist-{view.value}-panel"
        role="tabpanel"
        aria-labelledby="segmented-tablist-{view.value}-tab"
        hidden={horizontalValue !== view.value}
        style="color: var(--cinder-text-muted);"
      >
        {view.body}
      </div>
    {/each}
  </div>

  <div style="display: grid; gap: 0.75rem; justify-items: start; width: 100%;">
    <SegmentedControl
      id="segmented-tablist-vertical"
      selectionMode="single"
      variant="tablist"
      orientation="vertical"
      bind:value={verticalValue}
      label="Review view (vertical)"
    >
      {#each views as view (view.value)}
        <Segment
          id="segmented-tablist-v-{view.value}-tab"
          value={view.value}
          controls="segmented-tablist-v-{view.value}-panel"
        >
          {view.label}
        </Segment>
      {/each}
    </SegmentedControl>

    {#each views as view (view.value)}
      <div
        id="segmented-tablist-v-{view.value}-panel"
        role="tabpanel"
        aria-labelledby="segmented-tablist-v-{view.value}-tab"
        hidden={verticalValue !== view.value}
        style="color: var(--cinder-text-muted);"
      >
        {view.body}
      </div>
    {/each}
  </div>
</div>
