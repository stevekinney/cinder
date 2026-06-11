# NavigationItem

Individual link or button within a navigation bar, supporting active and disabled states.

## Usage

```svelte
<script lang="ts">
  import NavigationItem from '@lostgradient/cinder/navigation-item';
</script>

<NavigationItem />
```

## Props

<!-- generated:props:start -->

| Prop       | Type                                                                     | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `active`   | `boolean`                                                                | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `class`    | `string`                                                                 | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `current`  | `"true"` \| `"page"` \| `"step"` \| `"location"` \| `"date"` \| `"time"` | no       | —       | The `aria-current` token emitted while `active` is true. Defaults to `'page'`, which is correct for navigation bars and breadcrumb-adjacent links. Use `'true'` (or another standard token such as `'step'` / `'location'`) for section/view switchers, where `'page'` would mislabel the current section as the current page in the browsing context.                                                                                                                                                                                                                                                  |
| `disabled` | `boolean`                                                                | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `href`     | `string`                                                                 | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `variant`  | `"horizontal"` \| `"vertical"` \| `"mobile"`                             | no       | —       | Controls item geometry. Emitted as `data-variant`. Default `'horizontal'`. - `'horizontal'`: top-rounded radius, accent bottom-border active indicator. Used inside `NavigationBar` and similar horizontal tab-bar contexts. - `'mobile'`: stacked full-width layout when an owning navigation surface enters its narrow container mode. - `'vertical'`: square row geometry, neutral selected surface, and accent inline-start border active indicator. Used inside `SideNavigation` (set automatically by `SideNavigationItem`) or standalone sidebar footers where flush sidebar edges are required. |
| `children` | `(opaque)`                                                               | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `onclick`  | `(opaque)`                                                               | no       | —       | Optional click handler called for the rendered `<a>` element. Useful for intercepting plain left-clicks for SPA navigation while letting modified clicks (cmd/ctrl/shift/alt or middle-click) fall through to native browser behavior. Disabled-state preventDefault still applies. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
