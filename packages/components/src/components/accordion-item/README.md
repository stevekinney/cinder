# AccordionItem

A single expandable panel inside an `Accordion`. Reads the accordion context to drive its expanded state and toggle behavior.

## Usage

`AccordionItem` is a compose-only leaf of [`Accordion`](../accordion/README.md).
The idiomatic API is `Accordion.Item`, reached through the parent namespace —
see the [Accordion README](../accordion/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/accordion-item` subpath remains exported for
à-la-carte builds that import the leaf directly.

`AccordionItem` throws if used outside an `Accordion` — the context lookup is
required.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                  |
| ---------- | ---------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       | Additional CSS class merged with `.cinder-accordion-item`.                                                                   |
| `disabled` | `boolean`  | no       | `false` | When true, the item cannot be toggled.                                                                                       |
| `id`       | `string`   | yes      | —       | Unique identifier matched against Accordion's expandedIds.                                                                   |
| `style`    | `string`   | no       | —       | Inline style string applied to the `.cinder-accordion-item` root.                                                            |
| `title`    | `string`   | yes      | —       | Visible header label for the item.                                                                                           |
| `children` | `(opaque)` | yes      | —       | Panel content rendered when the item is expanded. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-accordion-item-panel-font-size`
- `--cinder-accordion-item-panel-inner-padding-block-end`
- `--cinder-accordion-item-panel-inner-padding-block-start`
- `--cinder-accordion-item-panel-inner-padding-inline`
- `--cinder-accordion-item-panel-line-height`
- `--cinder-accordion-item-trigger-font-size`
- `--cinder-accordion-item-trigger-font-weight`
- `--cinder-accordion-item-trigger-gap`
- `--cinder-accordion-item-trigger-padding-block`
- `--cinder-accordion-item-trigger-padding-inline`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
