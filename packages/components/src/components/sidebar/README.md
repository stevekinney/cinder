# Sidebar

Persistent side panel that houses navigation, filters, or supplementary page content.

## Usage

```svelte
<script lang="ts">
  import Sidebar from '@lostgradient/cinder/sidebar';
</script>

<Sidebar label="App sidebar">
  {#snippet navigation()}
    <nav><!-- navigation items --></nav>
  {/snippet}
</Sidebar>
```

## Props

<!-- generated:props:start -->

| Prop               | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`            | `string`   | no       | —       | Additional CSS class merged with `.cinder-sidebar`.                                                                                                                                                                                                                                                                                                      |
| `collapsed`        | `boolean`  | no       | —       | Whether the sidebar is collapsed. Bindable via `bind:collapsed`. Default `false`. Above `mobileBreakpoint`, `collapsed=true` switches the sidebar to icon-only mode. At or below `mobileBreakpoint`, the sidebar renders inside a `<Drawer>` and `collapsed=true` means the drawer is closed.                                                            |
| `label`            | `string`   | no       | —       | Accessible name for the outer landmark and the mobile drawer. Required — defaults to `'Sidebar'` for convenience but must be unique per page. The inner `<nav>` landmark derives its own accessible name from this value by appending `' navigation'` so screen readers can distinguish the outer complementary region from the inner navigation region. |
| `mobileBreakpoint` | `string`   | no       | —       | Viewport width below which the sidebar switches from the inline aside to the mobile drawer. Accepts a simple CSS length such as `'47.99rem'` or `'1024px'`. Default `'47.99rem'`.                                                                                                                                                                        |
| `brand`            | `(opaque)` | no       | —       | Optional branding region rendered above the navigation. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                       |
| `footer`           | `(opaque)` | no       | —       | Optional footer region (e.g. user account, sign-out). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                         |
| `navigation`       | `(opaque)` | no       | —       | Navigation region. Typically a `<SideNavigation>` subtree. Optional — when omitted, no `<nav>` landmark is rendered (so the sidebar can serve as app chrome without a navigation list, and an empty `<nav>` isn't announced to screen readers). Not expressible in JSON Schema; see the component types for the signature.                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-sidebar-mobile-breakpoint`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
