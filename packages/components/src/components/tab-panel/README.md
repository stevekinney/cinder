# TabPanel

Content region associated with a tab trigger; shown when its tab is active.

## Usage

`TabPanel` is a compose-only leaf of [`Tabs`](../tabs/README.md). The idiomatic API is `Tabs.Panel`, reached through the parent namespace — see the [tabs README](../tabs/README.md#usage) for the composed snippet. The leaf is also a named export of `@lostgradient/cinder`.

## Props

<!-- generated:props:start -->

| Prop             | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                         |
| ---------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabelledby` | `string`   | no       | —       | Override the `aria-labelledby` target. By default the panel points at the context-derived Tab id (`${baseId}-tab-${value}`). Supply this only when you have overridden the paired Tab's `id` prop — pass that same custom id here so the ARIA tab→panel relationship stays wired to a real element. |
| `class`          | `string`   | no       | —       | Additional class names merged with `.cinder-tab-panel`.                                                                                                                                                                                                                                             |
| `value`          | `string`   | yes      | —       | Identifier — matches the value of the corresponding Tab.                                                                                                                                                                                                                                            |
| `children`       | `(opaque)` | yes      | —       | Panel content. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                           |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
