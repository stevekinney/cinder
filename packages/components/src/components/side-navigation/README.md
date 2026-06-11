# SideNavigation

Vertical navigation panel for secondary or hierarchical app destinations.

## Usage

`SideNavigation` is a compound component. Import the parent and compose
`SideNavigation.Group` and `SideNavigation.Item` via the namespace API.

```svelte
<script lang="ts">
  import { SideNavigation } from '@lostgradient/cinder/side-navigation';
</script>

<SideNavigation ariaLabel="Workspace">
  <SideNavigation.Item href="/dashboard">Dashboard</SideNavigation.Item>
  <SideNavigation.Group label="Projects">
    <SideNavigation.Item href="/projects/phoenix" active>Phoenix</SideNavigation.Item>
    <SideNavigation.Item href="/projects/atlas">Atlas</SideNavigation.Item>
  </SideNavigation.Group>
</SideNavigation>
```

The leaves remain importable individually for à-la-carte builds — see
`@lostgradient/cinder/side-navigation-group` and `@lostgradient/cinder/side-navigation-item`.

## Props

<!-- generated:props:start -->

| Prop        | Type       | Required | Default | Description                                                                                                                                                                                            |
| ----------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ariaLabel` | `string`   | yes      | —       | Accessible name for the <nav> landmark. Required, non-empty, distinct from other navs on the page.                                                                                                     |
| `children`  | `(opaque)` | yes      | —       | Must be <li> elements containing NavigationItem and/or SideNavigationGroup. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `class`     | `(opaque)` | no       | —       | Additional CSS class merged with `.cinder-side-navigation`. A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `SideNavigation.Group` — a collapsible labelled section; see
  [`side-navigation-group`](../side-navigation-group/README.md).
- `SideNavigation.Item` — a navigation link or button rendered inside the
  sidebar list; see [`side-navigation-item`](../side-navigation-item/README.md).

<!-- generated:subcomponents:end -->
