# SideNavigationGroup

A SideNavigationGroup component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`SideNavigationGroup` is a compose-only leaf of [`SideNavigation`](../side-navigation/README.md).
The idiomatic API is `SideNavigation.Group`, reached through the parent
namespace — see the [side-navigation README](../side-navigation/README.md#usage) for the composed
snippet. The flat `cinder/side-navigation-group` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                    |
| ---------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `disabled` | `boolean`  | no       | —       | When true, the disclosure button is disabled. Default: false.                                                                  |
| `expanded` | `boolean`  | no       | —       | Whether the group is expanded. Bindable. Default: true.                                                                        |
| `id`       | `string`   | no       | —       | Optional stable id for the root <li>. Trigger uses `${id}-trigger`, panel uses `${id}-panel`. If omitted, generated via useId. |
| `label`    | `string`   | yes      | —       | Visible section header label.                                                                                                  |
| `badge`    | `(opaque)` | —        | —       | function-or-snippet                                                                                                            |
| `children` | `(opaque)` | —        | —       | function-or-snippet                                                                                                            |
| `class`    | `(opaque)` | —        | —       | unknown-shape                                                                                                                  |
| `icon`     | `(opaque)` | —        | —       | function-or-snippet                                                                                                            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
