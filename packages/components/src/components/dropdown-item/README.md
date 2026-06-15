# DropdownItem

Selectable item within a dropdown menu, supporting icons, labels, and keyboard navigation.

## Usage

`DropdownItem` is a compose-only leaf of [`Dropdown`](../dropdown/README.md).
The idiomatic API is `Dropdown.Item`, reached through the parent
namespace — see the [dropdown README](../dropdown/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/dropdown-item` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop            | Type                                  | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | ------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`         | `string`                              | no       | —       | Additional class names merged with the component's root class.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `closeOnSelect` | `boolean`                             | no       | —       | When true, the parent dropdown closes after this item is activated. Default `true`.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `disabled`      | `boolean`                             | no       | —       | When true the item is inert: click is blocked and aria-disabled is set.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `href`          | `string`                              | no       | —       | Destination URL. Any defined value — including an empty string — selects the anchor branch and renders an `<a>`. Omit `href` entirely to render a `<button>`.                                                                                                                                                                                                                                                                                                                                             |
| `inset`         | `boolean`                             | no       | —       | When true, adds leading padding to align the item with items that have a leading icon or indicator. Default `false`.                                                                                                                                                                                                                                                                                                                                                                                      |
| `type`          | `"button"` \| `"submit"` \| `"reset"` | no       | —       | Button type forwarded to the `<button>` element. Defaults to `"button"`. NOTE: `type="submit"` only submits a surrounding `<form>` when the menu stays inside that form's DOM subtree. DropdownMenu portals its panel to `document.body` on the non-popover fallback path, so a submit item is then NOT a form descendant and native submission is skipped. To submit a form from a portaled menu, set `form="<form-id>"` to associate the button with the form by id, or handle submission in `onclick`. |
| `variant`       | `"default"` \| `"danger"`             | no       | —       | Visual style of the item. Use `danger` to signal a destructive action. Default `default`.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `children`      | `(opaque)`                            | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
