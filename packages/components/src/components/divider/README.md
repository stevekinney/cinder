# Divider

A 1px visual rule for separating content regions. Horizontal by default; pass `orientation="vertical"` for toolbar group separators inside a flex container.

The canonical use case is **vertical dividers between toolbar groups**—for example, between action clusters in a `NavigationBar`. Because toolbars use horizontal flex layout, a vertical divider stretches to the row height automatically via `align-self: stretch`.

## Usage

```svelte
<script lang="ts">
  import Divider from 'cinder/divider';
</script>

<!-- Horizontal rule between sections -->
<Divider />

<!-- Vertical rule between toolbar groups -->
<div style="display: flex; align-items: center; gap: 8px;">
  <button>Bold</button>
  <Divider orientation="vertical" />
  <button>Insert</button>
</div>
```

## Props

<!-- generated:props:start -->

| Prop          | Type                           | Required | Default        | Description                                                        |
| ------------- | ------------------------------ | -------- | -------------- | ------------------------------------------------------------------ |
| `class`       | `string`                       | no       | —              | Additional class names merged with `.cinder-divider`.              |
| `decorative`  | `boolean`                      | no       | `true`         | When `true` the element is hidden from assistive technology.       |
| `inset`       | `boolean`                      | no       | `false`        | Shortens the rule by `--cinder-space-2` on the perpendicular axis. |
| `orientation` | `"horizontal"` \| `"vertical"` | no       | `"horizontal"` | Layout axis the rule spans.                                        |
| `tone`        | `"subtle"` \| `"strong"`       | no       | `"subtle"`     | Visual weight of the divider line.                                 |

<!-- generated:props:end -->

## Accessibility

`decorative={true}` (the default) hides the element from assistive technology entirely with `aria-hidden="true"`. Use this for visual polish only.

`decorative={false}` exposes the element to screen readers. A horizontal divider renders as `<hr>`; a vertical divider renders as `<span role="separator" aria-orientation="vertical">`.

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
