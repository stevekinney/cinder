# TabPanel

A TabPanel component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`TabPanel` is a compose-only leaf of [`Tabs`](../tabs/README.md).
The idiomatic API is `Tabs.Panel`, reached through the parent
namespace — see the [tabs README](../tabs/README.md#usage) for the composed
snippet. The flat `cinder/tab-panel` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                |
| ---------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       | Additional class names merged with `.cinder-tab-panel`.                                                                    |
| `value`    | `string`   | yes      | —       | Identifier — matches the value of the corresponding Tab.                                                                   |
| `children` | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
