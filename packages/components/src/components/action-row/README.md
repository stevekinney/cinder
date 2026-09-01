# ActionRow

Full-width button row for selectable sidebars, timelines, and master-detail lists.

Use `ActionRow` when each item in a list should behave like a full-width button with
selection state and optional leading, description, metadata, and trailing regions.

Use the default `selectedState="pressed"` for in-page selection, such as a session
list that swaps the detail panel without navigating. Use `selectedState="current"`
when the row represents the current step, edge, page, or location in a larger set;
set `currentValue` to the matching `aria-current` value.

ActionRow owns the interactive target. Do not put it on an interactive list-item
root or nest secondary buttons inside the row. If the full row navigates to a URL,
use `NavigationItem` instead. Use `StackedListItem` with `href` when only the title
should be a link and trailing controls remain separate. If the content is static,
use `DataList` and `StackedListItem`.

## Usage

```svelte
<script lang="ts">
  import ActionRow from '@lostgradient/cinder/action-row';

  let selectedRun = $state('run-2');

  const runs = [
    { id: 'run-1', title: 'Morning sync', status: 'Queued', time: '09:00' },
    { id: 'run-2', title: 'Webhook replay', status: 'Running', time: '09:12' },
    { id: 'run-3', title: 'Cleanup sweep', status: 'Finished', time: '09:18' },
  ];
</script>

<div style="display: grid; gap: var(--cinder-space-1); max-inline-size: 28rem;">
  {#each runs as run (run.id)}
    <ActionRow
      selected={selectedRun === run.id}
      onclick={() => {
        selectedRun = run.id;
      }}
    >
      {#snippet title()}{run.title}{/snippet}
      {#snippet description()}{run.status}{/snippet}
      {#snippet meta()}Run {run.id}{/snippet}
      {#snippet trailing()}{run.time}{/snippet}
    </ActionRow>
  {/each}
</div>
```

## CSS Variables

Override these variables on the `ActionRow` root with a `style` attribute or a
stylesheet rule that targets your row class.

<!-- generated:variables:start -->

- `--cinder-action-row-body-gap`
- `--cinder-action-row-description-font-size`
- `--cinder-action-row-layout-column-gap`
- `--cinder-action-row-layout-row-gap`
- `--cinder-action-row-meta-font-size`
- `--cinder-action-row-padding-block`
- `--cinder-action-row-padding-inline`
- `--cinder-action-row-title-font-size`
- `--cinder-action-row-trailing-gap`
<!-- generated:variables:end -->
