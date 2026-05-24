# TabList

A TabList component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`TabList` is a compose-only leaf of [`Tabs`](../tabs/README.md).
The idiomatic API is `Tabs.List`, reached through the parent
namespace — see the [tabs README](../tabs/README.md#usage) for the composed
snippet. The flat `cinder/tab-list` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop         | Type       | Required | Default | Description                                                     |
| ------------ | ---------- | -------- | ------- | --------------------------------------------------------------- |
| `class`      | `string`   | no       | —       | Additional class names merged with `.cinder-tab-list`.          |
| `label`      | `string`   | no       | —       | Optional accessible name for the tablist. Sets `aria-label`.    |
| `labelledBy` | `string`   | no       | —       | Reference to a heading or label element that names the tablist. |
| `children`   | `(opaque)` | —        | —       | function-or-snippet                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
