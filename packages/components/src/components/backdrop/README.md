# Backdrop

Full-viewport fixed scrim primitive for custom overlay patterns such as loading dimmers and image lightboxes.

## Usage

```svelte
<script lang="ts">
  import Backdrop from '@lostgradient/cinder/backdrop';
  import Button from '@lostgradient/cinder/button';
  import Spinner from '@lostgradient/cinder/spinner';

  let open = $state(false);
  let invisible = $state(false);
</script>

<div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
  <Button
    label="Show dimmed backdrop"
    onclick={() => {
      invisible = false;
      open = true;
    }}
  />
  <Button
    variant="secondary"
    label="Show invisible backdrop"
    onclick={() => {
      invisible = true;
      open = true;
    }}
  />
</div>

<Backdrop {open} {invisible} onclick={() => (open = false)}>
  <div
    style="display: flex; flex-direction: column; align-items: center; gap: 1rem; color: white; pointer-events: none;"
  >
    <Spinner size="lg" label="Loading" />
    <span style="font-size: 1rem; font-weight: 500;">Loading… click anywhere to dismiss</span>
  </div>
</Backdrop>
```

## Guidance

### Use When

- Providing a full-screen dimming layer behind a custom overlay that is not modal or drawer.
- Building a loading state that dims the full viewport while an async operation runs.

### Avoid When

- Interrupting the user for a decision — use modal or alert-dialog which manage focus and Escape automatically.
- Showing a side panel — use drawer instead.
- Showing structured content in a dialog — use modal or drawer, which render their own native `<dialog>::backdrop` scrim.

## Props

<!-- generated:props:start -->

| Prop                             | Type       | Required | Default | Description                                                                                                                                                |
| -------------------------------- | ---------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                          | `string`   | no       | —       | Additional class names merged onto the root element.                                                                                                       |
| `invisible`                      | `boolean`  | no       | `false` | When true the backdrop is transparent but still captures pointer events, enabling click-to-close without dimming content behind it.                        |
| `open`                           | `boolean`  | yes      | —       | Whether the backdrop is visible and active.                                                                                                                |
| `scrollLocked`                   | `boolean`  | no       | `true`  | Lock body scroll while the backdrop is open (counted lock — safe to nest with other overlays). Set false when the consumer manages scrolling itself.       |
| `transitionDurationMilliseconds` | `number`   | no       | —       | Enter/leave animation duration in milliseconds. Collapses to 0 under `prefers-reduced-motion`. Overrides the default when provided.                        |
| `children`                       | `(opaque)` | no       | —       | Optional content rendered above the scrim (e.g. a Spinner for a loading state). Not expressible in JSON Schema; see the component types for the signature. |
| `onclick`                        | `(opaque)` | no       | —       | Click handler — use this to wire click-to-close on the scrim. Not expressible in JSON Schema; see the component types for the signature.                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
