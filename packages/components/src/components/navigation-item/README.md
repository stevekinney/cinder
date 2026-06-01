# NavigationItem

Individual link or button within a navigation bar, supporting active and disabled states.

## Usage

```svelte
<script lang="ts">
  import NavigationItem from 'cinder/navigation-item';
</script>

<NavigationItem />
```

## Props

<!-- generated:props:start -->

| Prop       | Type                                         | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | -------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `active`   | `boolean`                                    | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `class`    | `string`                                     | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `disabled` | `boolean`                                    | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `variant`  | `"horizontal"` \| `"mobile"` \| `"vertical"` | no       | —       | Controls item geometry. Emitted as `data-variant`. Default `'horizontal'`. - `'horizontal'`: top-rounded radius, accent bottom-border active indicator. Used inside `NavigationBar` and similar horizontal tab-bar contexts. - `'mobile'`: stacked full-width layout when an owning navigation surface enters its narrow container mode. - `'vertical'`: square row geometry, neutral selected surface, and accent inline-start border active indicator. Used inside `SideNavigation` (set automatically by `SideNavigationItem`) or standalone sidebar footers where flush sidebar edges are required. |
| `children` | `(opaque)`                                   | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `onclick`  | `(opaque)`                                   | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
