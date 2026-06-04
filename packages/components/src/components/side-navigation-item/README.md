# SideNavigationItem

Individual link within a side navigation, supporting nesting and active highlighting.

## Usage

`SideNavigationItem` is a compose-only leaf of [`SideNavigation`](../side-navigation/README.md).
The idiomatic API is `SideNavigation.Item`, reached through the parent
namespace — see the [side-navigation README](../side-navigation/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/side-navigation-item` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop            | Type                                                                     | Required | Default | Description                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `active`        | `boolean`                                                                | no       | —       |                                                                                                                                                                                                                                                                                                                                                        |
| `class`         | `string`                                                                 | no       | —       |                                                                                                                                                                                                                                                                                                                                                        |
| `current`       | `"true"` \| `"page"` \| `"step"` \| `"location"` \| `"date"` \| `"time"` | no       | —       | The `aria-current` token emitted while `active` is true. Defaults to `'page'`, which is correct for navigation bars and breadcrumb-adjacent links. Use `'true'` (or another standard token such as `'step'` / `'location'`) for section/view switchers, where `'page'` would mislabel the current section as the current page in the browsing context. |
| `disabled`      | `boolean`                                                                | no       | —       |                                                                                                                                                                                                                                                                                                                                                        |
| `href`          | `string`                                                                 | no       | —       |                                                                                                                                                                                                                                                                                                                                                        |
| `listItemClass` | `string`                                                                 | no       | —       | Class merged onto the outer <li>.                                                                                                                                                                                                                                                                                                                      |
| `children`      | `(opaque)`                                                               | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                             |
| `onclick`       | `(opaque)`                                                               | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
