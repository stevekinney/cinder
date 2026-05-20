# Sheet

A Sheet component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Sheet from 'cinder/sheet';
</script>

<Sheet />
```

## Props

<!-- generated:props:start -->

| Prop             | Type               | Required | Default | Description                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ------------------ | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabelledBy` | `string`           | no       | —       | Optional id of an element that names the sheet. When supplied, sheet wires `aria-labelledby` to this id and renders no internal heading. Use this when a custom `header` snippet has its own visible heading — supply `ariaLabelledBy` pointing to that heading's id so the visible and accessible names stay in sync.           |
| `class`          | `string`           | no       | —       | Additional class names merged with `.cinder-sheet`.                                                                                                                                                                                                                                                                              |
| `open`           | `boolean`          | no       | —       | Whether the sheet is open. Bindable via `bind:open`.                                                                                                                                                                                                                                                                             |
| `showDragHandle` | `boolean`          | no       | —       | When `true`, render a decorative drag handle above the header. Swipe-to-close gesture is a stretch goal not implemented in MVP — the handle is purely a visual affordance. Default `false`. Named `showDragHandle` (not `draggable`) to avoid colliding with the native HTML `draggable` attribute on the underlying `<dialog>`. |
| `title`          | `string`           | yes      | —       | Accessible name for the sheet. Required for screen-reader labelling. Rendered as a visible `<h2>` in the default header. When a custom `header` snippet is provided without `ariaLabelledBy`, this text is rendered in a visually-hidden `<h2>` as the accessible name fallback.                                                 |
| `triggerRef`     | `object` \| `null` | no       | —       | Optional reference to the element that opened the sheet. When supplied, focus returns to this element on close. When omitted, focus restores to the element that held focus before the sheet opened.                                                                                                                             |
| `children`       | `(opaque)`         | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                              |
| `footer`         | `(opaque)`         | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                              |
| `header`         | `(opaque)`         | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
