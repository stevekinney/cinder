# Sidebar

Persistent side panel that houses navigation, filters, or supplementary page content.

## Usage

```svelte
<script lang="ts">
  import Sidebar from '@lostgradient/cinder/sidebar';
</script>

<Sidebar />
```

## Props

<!-- generated:props:start -->

| Prop         | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabel`  | `string`   | no       | —       | Accessible name for the outer landmark and the mobile drawer. Required — defaults to `'Sidebar'` for convenience but must be unique per page. The inner `<nav>` landmark derives its own accessible name from this value by appending `' navigation'` so screen readers can distinguish the outer complementary region from the inner navigation region.                   |
| `class`      | `string`   | no       | —       | Additional CSS class merged with `.cinder-sidebar`.                                                                                                                                                                                                                                                                                                                        |
| `collapsed`  | `boolean`  | no       | —       | Whether the sidebar is collapsed. Bindable via `bind:collapsed`. Default `false`. On desktop (>= md breakpoint) `collapsed=true` switches the sidebar to icon-only mode. Below the md breakpoint the sidebar renders inside a `<Drawer>` and `collapsed=true` means the drawer is closed.                                                                                  |
| `brand`      | `(opaque)` | no       | —       | Optional branding region rendered above the navigation. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                         |
| `footer`     | `(opaque)` | no       | —       | Optional footer region (e.g. user account, sign-out). A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                           |
| `navigation` | `(opaque)` | no       | —       | Navigation region. Typically a `<SideNavigation>` subtree. Optional — when omitted, no `<nav>` landmark is rendered (so the sidebar can serve as app chrome without a navigation list, and an empty `<nav>` isn't announced to screen readers). A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
