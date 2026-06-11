# Tab

Individual tab trigger within a tab list for switching between labelled content panels.

## Usage

`Tab` is a compose-only leaf of [`Tabs`](../tabs/README.md).
The idiomatic API is `Tabs.Trigger`, reached through the parent
namespace — see the [tabs README](../tabs/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/tab` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       | Additional class names merged with `.cinder-tab`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `disabled` | `boolean`  | no       | —       | Disables this single tab. The panel content is hidden but its DOM stays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `id`       | `string`   | no       | —       | Optional explicit id override; auto-generated otherwise for ARIA wiring.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `value`    | `string`   | yes      | —       | Identifier — matches the value of the corresponding TabPanel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `children` | `(opaque)` | yes      | —       | Tab label content. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `trailing` | `(opaque)` | no       | —       | Decorative content rendered inside an `aria-hidden` span (badges, kbd hints, counters). Do NOT use for interactive controls like close buttons — `aria-hidden` removes the content from the accessibility tree, making any interactive child unreachable by keyboard and invisible to screen readers. For a closeable tab, render a separate `<button>` immediately after the `<Tab>` in the DOM (as a sibling within the tab strip) and associate it with the tab via `aria-label="Close [tab name]"`. The close button must live outside the `<Tab>` element entirely. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
