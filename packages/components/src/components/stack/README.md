# Stack

One-dimensional layout primitive for arranging direct children with flexbox.

## Usage

```svelte
<script lang="ts">
  import Stack from '@lostgradient/cinder/stack';
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
