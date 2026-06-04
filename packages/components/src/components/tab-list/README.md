# TabList

Keyboard-navigable row of tab triggers that control which tab panel is visible.

## Usage

`TabList` is a compose-only leaf of [`Tabs`](../tabs/README.md).
The idiomatic API is `Tabs.List`, reached through the parent
namespace — see the [tabs README](../tabs/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/tab-list` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop         | Type       | Required | Default | Description                                                                                                                |
| ------------ | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`      | `string`   | no       | —       | Additional class names merged with `.cinder-tab-list`.                                                                     |
| `label`      | `string`   | no       | —       | Optional accessible name for the tablist. Sets `aria-label`.                                                               |
| `labelledBy` | `string`   | no       | —       | Reference to a heading or label element that names the tablist.                                                            |
| `children`   | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
