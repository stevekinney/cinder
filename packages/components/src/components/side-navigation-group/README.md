# SideNavigationGroup

Collapsible group header that organises related items within a side navigation.

## Usage

`SideNavigationGroup` is a compose-only leaf of [`SideNavigation`](../side-navigation/README.md).
The idiomatic API is `SideNavigation.Group`, reached through the parent
namespace — see the [side-navigation README](../side-navigation/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/side-navigation-group` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                                                                  |
| ---------- | ---------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disabled` | `boolean`  | no       | —       | When true, the disclosure button is disabled. Default: false.                                                                                                                |
| `expanded` | `boolean`  | no       | —       | Whether the group is expanded. Bindable. Default: true.                                                                                                                      |
| `id`       | `string`   | no       | —       | Optional stable id for the root <li>. Trigger uses `${id}-trigger`, panel uses `${id}-panel`. If omitted, generated via useId.                                               |
| `label`    | `string`   | yes      | —       | Visible section header label.                                                                                                                                                |
| `badge`    | `(opaque)` | no       | —       | Optional trailing badge rendered inside the header button after the label, before the chevron. Not expressible in JSON Schema; see the component types for the signature.    |
| `children` | `(opaque)` | yes      | —       | Must be <li>-wrapped NavigationItems (or SideNavigationItems) rendered inside the disclosed <ul>. Not expressible in JSON Schema; see the component types for the signature. |
| `class`    | `(opaque)` | no       | —       | Additional CSS class merged with `.cinder-side-navigation-group`. Not expressible in JSON Schema; see the component types for the signature.                                 |
| `icon`     | `(opaque)` | no       | —       | Optional leading icon rendered inside the header button before the label. Not expressible in JSON Schema; see the component types for the signature.                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
