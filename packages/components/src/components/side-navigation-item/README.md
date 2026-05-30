# SideNavigationItem

A SideNavigationItem component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`SideNavigationItem` is a compose-only leaf of [`SideNavigation`](../side-navigation/README.md).
The idiomatic API is `SideNavigation.Item`, reached through the parent
namespace — see the [side-navigation README](../side-navigation/README.md#usage) for the composed
snippet. The flat `cinder/side-navigation-item` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop            | Type       | Required | Default | Description                                                                                                                |
| --------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `active`        | `boolean`  | no       | —       |                                                                                                                            |
| `class`         | `string`   | no       | —       |                                                                                                                            |
| `disabled`      | `boolean`  | no       | —       |                                                                                                                            |
| `listItemClass` | `string`   | no       | —       | Class merged onto the outer <li>.                                                                                          |
| `children`      | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onclick`       | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
