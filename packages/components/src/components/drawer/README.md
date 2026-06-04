# Drawer

Side-anchored overlay panel for supplementary content without leaving the current page.

## When to use

- Showing detail or edit forms alongside a list or table where the user needs to stay in context.
- Navigation trees, filter panels, or settings that the user may want to keep open while interacting with the page.
- Secondary workflows that complement the current view rather than replacing it.

## When not to use

- Full-screen workflows that require the user's full attention — use a [`Modal`](../modal/README.md) or navigate to a new page.
- Mobile-style bottom sheets — use [`Sheet`](../sheet/README.md) for the bottom-anchored variant.
- Brief contextual explanations or single-action prompts — use a [`Popover`](../popover/README.md) instead.

## Related components

- [`Modal`](../modal/README.md) — blocking full-attention overlay when the user cannot continue without acting.
- [`Sheet`](../sheet/README.md) — bottom-anchored overlay optimised for mobile interactions.
- [`Sidebar`](../sidebar/README.md) — persistent side panel that is always visible (not overlaid).

## Usage

```svelte
<script lang="ts">
  import Drawer from '@lostgradient/cinder/drawer';
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
