# SideNavigation

A SideNavigation component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`SideNavigation` is a compound component. Import the parent and compose
`SideNavigation.Group` and `SideNavigation.Item` via the namespace API.

```svelte
<script lang="ts">
  import { SideNavigation } from 'cinder/side-navigation';
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
`cinder/side-navigation-group` and `cinder/side-navigation-item`.

## Props

<!-- generated:props:start -->

| Prop        | Type       | Required | Default | Description                                                                                                                |
| ----------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabel` | `string`   | yes      | —       | Accessible name for the <nav> landmark. Required, non-empty, distinct from other navs on the page.                         |
| `children`  | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `class`     | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

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
