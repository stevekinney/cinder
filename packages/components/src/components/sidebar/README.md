# Sidebar

A Sidebar component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Sidebar from 'cinder/sidebar';
</script>

<Sidebar />
```

## Props

<!-- generated:props:start -->

| Prop         | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                              |
| ------------ | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabel`  | `string`   | no       | —       | Accessible name for the outer landmark and the mobile drawer. Required — defaults to `'Sidebar'` for convenience but must be unique per page. The inner `<nav>` landmark derives its own accessible name from this value by appending `' navigation'` so screen readers can distinguish the outer complementary region from the inner navigation region. |
| `class`      | `string`   | no       | —       | Additional CSS class merged with `.cinder-sidebar`.                                                                                                                                                                                                                                                                                                      |
| `collapsed`  | `boolean`  | no       | —       | Whether the sidebar is collapsed. Bindable via `bind:collapsed`. Default `false`. On desktop (>= md breakpoint) `collapsed=true` switches the sidebar to icon-only mode. Below the md breakpoint the sidebar renders inside a `<Drawer>` and `collapsed=true` means the drawer is closed.                                                                |
| `brand`      | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                                                      |
| `footer`     | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                                                      |
| `navigation` | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
