# NavigationItem

A NavigationItem component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import NavigationItem from 'cinder/navigation-item';
</script>

<NavigationItem />
```

## Props

<!-- generated:props:start -->

| Prop       | Type                                         | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `active`   | `boolean`                                    | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `class`    | `string`                                     | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `disabled` | `boolean`                                    | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `variant`  | `"horizontal"` \| `"mobile"` \| `"vertical"` | no       | —       | Controls item geometry. Emitted as `data-variant`. Default `'horizontal'`. - `'horizontal'`: top-rounded radius, accent bottom-border active indicator. Used inside `NavigationBar` and similar horizontal tab-bar contexts. - `'mobile'`: stacked full-width layout below the mobile breakpoint. - `'vertical'`: square row geometry, neutral selected surface, and accent inline-start border active indicator. Used inside `SideNavigation` (set automatically by `SideNavigationItem`) or standalone sidebar footers where flush sidebar edges are required. |
| `children` | `(opaque)`                                   | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `onclick`  | `(opaque)`                                   | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
