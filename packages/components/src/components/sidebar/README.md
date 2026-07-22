# Sidebar

Persistent side panel that houses navigation, filters, or supplementary page content.

## Usage

```svelte
<script lang="ts">
  import Sidebar from '@lostgradient/cinder/sidebar';
  import SideNavigation from '@lostgradient/cinder/side-navigation';
</script>

<Sidebar label="App sidebar">
  {#snippet navigation()}
    <SideNavigation ariaLabel="Primary navigation">
      <!-- side-navigation items -->
    </SideNavigation>
  {/snippet}
</Sidebar>
```

## Props

<!-- generated:props:start -->

| Prop               | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                   |
| ------------------ | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`            | `string`   | no       | —       | Additional CSS class merged with `.cinder-sidebar`.                                                                                                                                                                                                                                           |
| `collapsed`        | `boolean`  | no       | —       | Whether the sidebar is collapsed. Bindable via `bind:collapsed`. Default `false`. Above `mobileBreakpoint`, `collapsed=true` switches the sidebar to icon-only mode. At or below `mobileBreakpoint`, the sidebar renders inside a `<Drawer>` and `collapsed=true` means the drawer is closed. |
| `label`            | `string`   | no       | —       | Accessible name for the outer landmark and the mobile drawer. Defaults to `'Sidebar'` for convenience but must be unique per page. Navigation content owns its own accessible name; for example, use `SideNavigation.ariaLabel`.                                                              |
| `mobileBreakpoint` | `string`   | no       | —       | Viewport width below which the sidebar switches from the inline aside to the mobile drawer. Accepts a simple CSS length such as `'47.99rem'` or `'1024px'`. Default `'47.99rem'`.                                                                                                             |
| `footer`           | `(opaque)` | no       | —       | Optional footer region (e.g. user account, sign-out). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                              |
| `navigation`       | `(opaque)` | no       | —       | Navigation content. Typically a `<SideNavigation>` subtree, which owns the navigation landmark and its accessible name. Optional so the sidebar can serve as app chrome without a navigation list. Not expressible in JSON Schema; see the component types for the signature.                 |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
