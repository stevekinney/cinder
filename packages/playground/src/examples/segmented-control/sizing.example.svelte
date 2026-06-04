<script lang="ts" module>
  export const title = 'Sizing — size vs. toolbar density';
  export const description =
    'Compares the three sizes (sm/md/lg) against `density="toolbar"`. Toolbar density resolves to the same compact visual size as `size="sm"` and ignores any explicit `size` value, so the toolbar-with-md and toolbar-with-lg controls render identically to the toolbar-without-size control and to `size="sm"`.';
</script>

<script lang="ts">
  import { Segment } from '@lostgradient/cinder/segment';
  import { SegmentedControl } from '@lostgradient/cinder/segmented-control';

  // Each control uses the same three options so size comparisons are not
  // polluted by label/structure differences. The selected option is
  // initialized to `rendered` (users can switch via click or keyboard) and
  // `diff` is disabled so disabled-state styling is exercised on every
  // control.
  type View = 'source' | 'rendered' | 'diff';

  let smValue = $state<View>('rendered');
  let mdValue = $state<View>('rendered');
  let lgValue = $state<View>('rendered');
  let toolbarValue = $state<View>('rendered');
  let toolbarMdValue = $state<View>('rendered');
  let toolbarLgValue = $state<View>('rendered');
</script>

<div style="display: grid; gap: 1rem; justify-items: start;">
  <SegmentedControl
    id="segmented-sizing-sm"
    selectionMode="single"
    size="sm"
    bind:value={smValue}
    label="size=sm"
  >
    <Segment value="source">Source</Segment>
    <Segment value="rendered">Rendered</Segment>
    <Segment value="diff" disabled>Diff</Segment>
  </SegmentedControl>

  <SegmentedControl
    id="segmented-sizing-md"
    selectionMode="single"
    size="md"
    bind:value={mdValue}
    label="size=md (default)"
  >
    <Segment value="source">Source</Segment>
    <Segment value="rendered">Rendered</Segment>
    <Segment value="diff" disabled>Diff</Segment>
  </SegmentedControl>

  <SegmentedControl
    id="segmented-sizing-lg"
    selectionMode="single"
    size="lg"
    bind:value={lgValue}
    label="size=lg"
  >
    <Segment value="source">Source</Segment>
    <Segment value="rendered">Rendered</Segment>
    <Segment value="diff" disabled>Diff</Segment>
  </SegmentedControl>

  <SegmentedControl
    id="segmented-sizing-toolbar"
    selectionMode="single"
    density="toolbar"
    bind:value={toolbarValue}
    label="density=toolbar (no size)"
  >
    <Segment value="source">Source</Segment>
    <Segment value="rendered">Rendered</Segment>
    <Segment value="diff" disabled>Diff</Segment>
  </SegmentedControl>

  <SegmentedControl
    id="segmented-sizing-toolbar-md"
    selectionMode="single"
    size="md"
    density="toolbar"
    bind:value={toolbarMdValue}
    label="density=toolbar + size=md (size is ignored)"
  >
    <Segment value="source">Source</Segment>
    <Segment value="rendered">Rendered</Segment>
    <Segment value="diff" disabled>Diff</Segment>
  </SegmentedControl>

  <SegmentedControl
    id="segmented-sizing-toolbar-lg"
    selectionMode="single"
    size="lg"
    density="toolbar"
    bind:value={toolbarLgValue}
    label="density=toolbar + size=lg (size is ignored)"
  >
    <Segment value="source">Source</Segment>
    <Segment value="rendered">Rendered</Segment>
    <Segment value="diff" disabled>Diff</Segment>
  </SegmentedControl>
</div>
