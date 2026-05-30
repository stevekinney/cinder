# Drawer

A Drawer component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Drawer from 'cinder/drawer';
</script>

<Drawer />
```

## Props

<!-- generated:props:start -->

| Prop             | Type                                 | Required | Default | Description                                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ariaLabelledBy` | `string`                             | no       | —       | Optional id of an element that names the drawer. When supplied, drawer wires `aria-labelledby` to this id and renders no internal heading. Use this when a custom `header` snippet has its own visible heading — supply `ariaLabelledBy` pointing to that heading's id so the visible and accessible names stay in sync. |
| `class`          | `string`                             | no       | —       | Additional class names merged with `.cinder-drawer`.                                                                                                                                                                                                                                                                     |
| `open`           | `boolean`                            | no       | —       | Whether the drawer is open. Bindable via `bind:open`.                                                                                                                                                                                                                                                                    |
| `side`           | `"left"` \| `"right"`                | no       | —       | Edge the drawer slides in from. Default `right`.                                                                                                                                                                                                                                                                         |
| `size`           | `"sm"` \| `"md"` \| `"lg"` \| `"xl"` | no       | —       | Drawer width token. Default `md`.                                                                                                                                                                                                                                                                                        |
| `title`          | `string`                             | yes      | —       | Accessible name for the drawer. Required for screen-reader labelling. Rendered as a visible `<h2>` in the default header. When a custom `header` snippet is provided without `ariaLabelledBy`, this text is rendered in a visually-hidden `<h2>` as the accessible name fallback.                                        |
| `children`       | `(opaque)`                           | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                               |
| `footer`         | `(opaque)`                           | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                               |
| `header`         | `(opaque)`                           | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                               |
| `triggerRef`     | `(opaque)`                           | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
