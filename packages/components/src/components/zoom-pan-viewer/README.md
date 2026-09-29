# ZoomPanViewer

An accessible viewport for panning and zooming images, SVGs, and Mermaid diagrams.

## Usage

```svelte
<script lang="ts">
  import { ZoomPanViewer } from '@lostgradient/cinder';
</script>

<ZoomPanViewer ariaLabel="Architecture diagram">
  {#snippet children()}
    <div
      style="min-width: 36rem; min-height: 12rem; padding: 3rem; background: var(--cinder-surface-raised);"
    >
      Architecture diagram
    </div>
  {/snippet}
</ZoomPanViewer>
```

The viewer starts at `scale={1}` and owns pointer and keyboard transforms for its child. `ariaLabel` names the viewport; it does not describe the diagram itself, so give the child or surrounding content a meaningful description as well. Use `onTransformChange` when the host needs to persist or mirror `{ scale, x, y }`. A failed diagram renderer should remain inside the viewport with an actionable error state—the viewer cannot retry a renderer it does not own.

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | ---------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabel`         | `string`   | no       | `"Zoomable viewer"` | Names the viewport. Does not describe the diagram itself. Defaults to `'Zoomable viewer'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `class`             | `string`   | no       | —                   | Additional class merged with the component's root class.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `scale`             | `number`   | no       | `1`                 | Starting zoom scale. Bindable, but clamping is render-only: an out-of-range or non-finite value is clamped to `0.25`–`8` (or normalized to `1` if non-finite) only in the transform actually rendered—the bound `scale` value itself is left as the caller set it and is not written back, so a parent observes its own out-of-range or non-finite value until an internal pointer/keyboard/control interaction calls `update()` and overwrites it. A programmatic external change to this prop does not itself fire `onTransformChange` (see that prop). Defaults to `1`.                                                                        |
| `children`          | `(opaque)` | yes      | —                   | Content the viewer pans and zooms. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `onTransformChange` | `(opaque)` | no       | —                   | Called with `{ scale, x, y }` after a pointer, keyboard, or control interaction runs, whether or not that interaction actually changed the transform—zooming in at the already-clamped `8` maximum, or resetting when already at the initial `{ scale: 1, x: 0, y: 0 }`, still calls this with the same values. Don't treat every call as a real change; compare against the previous transform if that matters. Not called when `scale` changes only because the caller passed a new value externally—hosts that need to react to that must watch `scale` themselves. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->
