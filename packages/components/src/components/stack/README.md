# Stack

One-dimensional layout primitive for arranging direct children with flexbox.

## Usage

```svelte
<script lang="ts">
  import { Stack } from '@lostgradient/cinder';
</script>

<Stack gap="var(--cinder-space-3)">
  <p>Primary content</p>
  <p>Supporting content</p>
</Stack>
```

## Props

`Stack` supports `direction`, `gap`, `align`, `justify`, `wrap`, `as`, `class`, and `children`.

## Accessibility

Stack does not add roles, keyboard behavior, or ARIA state. Choose `as` only when the rendered element carries correct document semantics for the content.

The default `direction` is `column` and `wrap` is `false`. `Stack` only owns layout: use `gap`, `align`, and `justify` for flex placement, and choose `as="ul"`, `as="nav"`, or another element only when the children satisfy that element's semantics. It does not make interactive children accessible or recover from overflow; choose a responsive layout or an explicit scroll container when content can exceed the available width.
