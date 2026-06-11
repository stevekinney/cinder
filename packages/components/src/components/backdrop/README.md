# Backdrop

Full-viewport fixed scrim primitive for custom overlay patterns such as loading dimmers and image lightboxes.

## Usage

```svelte
<script lang="ts">
  import { Backdrop } from '@lostgradient/cinder/backdrop';
</script>
```

## Guidance

### Use When

- Providing a full-screen dimming layer behind a custom overlay that is not modal, drawer, or sheet.
- Building a loading state that dims the full viewport while an async operation runs.

### Avoid When

- Interrupting the user for a decision — use modal or alert-dialog which manage focus and Escape automatically.
- Showing a side panel — use drawer instead.
- Showing structured content in a dialog — use modal, drawer, or sheet, which render their own native `<dialog>::backdrop` scrim.

## Props

<!-- generated:props:start -->

| Prop                 | Type       | Required | Default | Description                                                                                                                                                                                                |
| -------------------- | ---------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`              | `string`   | no       | —       | Additional class names merged onto the root element.                                                                                                                                                       |
| `invisible`          | `boolean`  | no       | `false` | When true the backdrop is transparent but still captures pointer events, enabling click-to-close without dimming content behind it.                                                                        |
| `lockScroll`         | `boolean`  | no       | `true`  | Lock body scroll while the backdrop is open (counted lock — safe to nest with other overlays). Set false when the consumer manages scrolling itself.                                                       |
| `open`               | `boolean`  | yes      | —       | Whether the backdrop is visible and active.                                                                                                                                                                |
| `transitionDuration` | `number`   | no       | —       | Enter/leave animation duration in milliseconds. Collapses to 0 under `prefers-reduced-motion`. Overrides the default when provided.                                                                        |
| `children`           | `(opaque)` | no       | —       | Optional content rendered above the scrim (e.g. a Spinner for a loading state). A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onclick`            | `(opaque)` | no       | —       | Click handler — use this to wire click-to-close on the scrim. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
