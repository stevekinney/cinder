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
| `triggerRef`     | `object` \| `null`                   | no       | —       | Optional reference to the element that opened the drawer. When supplied, focus returns to this element on close. When omitted, focus restores to the element that held focus before the drawer opened.                                                                                                                   |
| `children`       | `(opaque)`                           | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                      |
| `footer`         | `(opaque)`                           | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                      |
| `header`         | `(opaque)`                           | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
