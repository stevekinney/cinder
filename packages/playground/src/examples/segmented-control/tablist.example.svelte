<script lang="ts" module>
  export const title = 'Tablist variant';
  export const description =
    'The `variant="tablist"` treatment for picker-shaped controls that switch between externally owned panels. Unlike the default radiogroup, the tablist has no enclosing surface and marks the selected tab with an accent underline (horizontal) or inline-start bar (vertical). See docs/decisions/segmented-control-tablist-variant.md.';
</script>

<script lang="ts">
  import { Segment } from 'cinder/segment';
  import { SegmentedControl } from 'cinder/segmented-control';

  type View = 'editor' | 'diff' | 'summary';

  let horizontalValue = $state<View>('editor');
  let verticalValue = $state<View>('editor');
</script>

<div style="display: grid; gap: 1.5rem; justify-items: start;">
  <SegmentedControl
    id="segmented-tablist-horizontal"
    selectionMode="single"
    variant="tablist"
    bind:value={horizontalValue}
    label="Review view"
  >
    <Segment value="editor" controls="segmented-tablist-editor-panel">Editor</Segment>
    <Segment value="diff" controls="segmented-tablist-diff-panel">Diff</Segment>
    <Segment value="summary" controls="segmented-tablist-summary-panel">Summary</Segment>
  </SegmentedControl>

  <SegmentedControl
    id="segmented-tablist-vertical"
    selectionMode="single"
    variant="tablist"
    orientation="vertical"
    bind:value={verticalValue}
    label="Review view (vertical)"
  >
    <Segment value="editor" controls="segmented-tablist-v-editor-panel">Editor</Segment>
    <Segment value="diff" controls="segmented-tablist-v-diff-panel">Diff</Segment>
    <Segment value="summary" controls="segmented-tablist-v-summary-panel">Summary</Segment>
  </SegmentedControl>
</div>
